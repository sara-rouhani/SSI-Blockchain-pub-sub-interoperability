/**
 * Authors: Hai Nguyen, Sahilpreet Singh Sidhu, Chikamnaele Ngene
 * Supervisor: Sara Rouhani
 * 
 * REMARKS: Broker server listening for request from clients, giving verifications and doing authentications with 
 *          Hyperledger Aries (HA) agent. After that, the server sending clients' requested actions to 
 *          Hyperledger Fabric (HF) chaincode in order to interact with data inside the ledger.
 */

import express, { json, urlencoded } from 'express'
import cors from 'cors'

import { Contract, Gateway, Wallets } from 'fabric-network'
import FabricCAServices from 'fabric-ca-client'
import path from 'path'
import { buildCAClient, registerAndEnrollUser, enrollAdmin } from './../../../admin-user-creator/CAUtil'
import { buildCCPOrg1, buildWallet } from '../../../admin-user-creator/AppUtil'
import { BrokerAgent } from './BrokerAgent'
import { Client } from 'fabric-common'
import { Output } from './OutputClass'

const channelName = 'mychannel'                             // channel name of HF ledger
const chaincodeName = 'broker'                              // name of the using chaincode on HF ledger
const mspOrg = 'Org1MSP'                                    // Organization name of current peer
const walletPath = path.resolve(__dirname, '..', 'wallet')  // path of wallet to store admin and user information
const orgUserId = 'appUser'                                 // name of current peer

let wallet: any, 
    ccp: Client | Record<string, unknown>, 
    caClient: any,
    contract: Contract, 
    gateway: Gateway, 
    brokerAgent: BrokerAgent

/**
 * This function will set up wallet, admin and user for HF ledger and build a HA agent  
 */
let setUp = async function () {
  // setup the wallet to hold the credentials of the application user
  wallet = await buildWallet(Wallets, walletPath)

  // build an in memory object with the network configuration (also known as a connection profile)
  ccp = buildCCPOrg1()

  // build an instance of the fabric ca services client based on
  // the information in the network configuration
  caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com')

  // in a real application this would be done on an administrative flow, and only once
  await enrollAdmin(caClient, wallet, mspOrg)

  // in a real application this would be done only when a new user was required to be added
  // and would be part of an administrative flow
  await registerAndEnrollUser(caClient, wallet, mspOrg, orgUserId, 'org1.department1')

  // build an aries agent listening for connection from client's agent
  brokerAgent = await BrokerAgent.build()
}

/**
 * This function will connect with HF ledger
 */
let connect = async function (req: any, res: any, next: any) {

  gateway = new Gateway()

  try {
    // Create a new gateway for connecting to our peer node.
    await gateway.connect(ccp, { wallet, identity: orgUserId, discovery: { enabled: true, asLocalhost: true } })

    // Get the network (channel) our contract is deployed to.
    const network = await gateway.getNetwork(channelName)

    // Get the contract from the network.
    contract = network.getContract(chaincodeName)

    next()

  }
  catch (error) {
    await gateway.disconnect()
    res.status(500).json({ errorMessage: `Unable to connect with broker: ${error}` })
  }
}

let app = express()

app.use(cors())
// support parsing of application/json type post data
app.use(json())
// support parsing of application/x-www-form-urlencoded post data
app.use(urlencoded({
  extended: false
}))

app.use(connect)

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * This function will do authentication before let the client interact with HF ledger
 * 
 * @param clientDid did of the client trying to interact with HF ledger
 * @param callback function to perform client's action
 * @returns authentication message checking whether client connected to HA agent or not
 */
let auth = async (clientDid: string, callback: () => Promise<void>) => {
  let authMessage

  // perform client's action if their did is existed (client already connected)
  brokerAgent.connectionRecordClientId = (await brokerAgent.agent.connections.findByDid(clientDid))?.id
  if (brokerAgent.connectionRecordClientId) {
      await callback()
  }
  // prompt client to connect with HA agent first since their did is not existed
  else {
      authMessage = 'Please first connect to the broker agent'
  }

  brokerAgent.connectionRecordClientId = undefined
  brokerAgent.currentCredRecord = undefined
  return authMessage
}

/**
 * This function will take client's request when they want to connect with HA agent
 */
app.post('/connectToAgent', async function (req, res) {
  try {
    let { invitationUrl } = req.body
    let response

    // accept connection from client using the sent invitation url
    await brokerAgent.acceptConnection(invitationUrl)

    let proofResult = await brokerAgent.sendProofRequest('id')

    // client already connect before
    if (proofResult.isVerified) {
      console.log('Agent verified')
      response = Output.ConnectionEstablished
    }
    // client connect the first time and need a new credential
    else {
      await brokerAgent.sendMessage("New connection!, issuing credentials..")
      let isAccepted = await brokerAgent.issueCredential(undefined, undefined)
      if (isAccepted) {
        response = Output.ConnectionEstablished + ' and Credentials issued!'
      }
      else {
        console.log('Client decline credentials')
        response = 'Please accept credentials'
      }
    }
    brokerAgent.connectionRecordClientId = undefined

    res.status(200).json({ message: response })

  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to connect to agent: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will let client query a topic from HF ledger
 */
app.post('/queryTopic', async function (req, res) {
  try {

    let { topicNumber, clientDid, clientThreadId } = req.body
    let response

    let authMessage = await auth(clientDid, async () => {

      // get the topic from HF ledger 
      let result = await contract.evaluateTransaction('queryTopic', topicNumber)
      let resultJSON = JSON.parse(result.toString())
      
      // check whether the topic is existed or not
      if(resultJSON.message && resultJSON.message == `${topicNumber} does not exist`) {
        response = resultJSON
      }
      else {
        // check whether client is permitted to query the topic
        await brokerAgent.setCurrCredFromThread(clientThreadId)
        if (brokerAgent.checkTopics(topicNumber, false)) {
          response = resultJSON
        }
        else {
          response = { message: 'The agent is not permitted to query this topic' }
        }
      }
    })

    res.status(200).json(authMessage ? {message: authMessage} : response)
  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to query topic: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will let client create a new topic in HF ledger
 */
app.post('/createTopic', async function (req, res) {
  try {

    let { topicNumber, topicName, message, clientDid, clientThreadId } = req.body
    let response

    let authMessage = await auth(clientDid, async () => {
      let result = await contract.submitTransaction('createTopic', topicNumber, topicName, message)
      let resultJSON = JSON.parse(result.toString())

      // give client a new credential if the topic is successfully created
      if (resultJSON.message == `${topicNumber} is created`) {
        await brokerAgent.setCurrCredFromThread(clientThreadId)
        await brokerAgent.sendMessage('Issuing new Credentials...')
        await brokerAgent.issueCredential(topicNumber, true)
      }
      response = resultJSON.message
    })

    res.status(200).json({ message: authMessage ? authMessage : response })
  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to create topic: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will let client modify an existed topic in HF ledger
 */
app.post('/publishToTopic', async function (req, res) {
  try {

    let { topicNumber, message: newMessage, clientDid, clientThreadId } = req.body
    let response

    let authMessage = await auth(clientDid, async () => {
      let result = await contract.evaluateTransaction('queryTopic', topicNumber)
      let resultJSON = JSON.parse(result.toString())

      // check whether the topic is existed in HF ledger or not
      if(resultJSON.message && resultJSON.message == `${topicNumber} does not exist`) {
        response = resultJSON.message
      }
      else {
        // check whether the client is permitted to modify the topic or not
        await brokerAgent.setCurrCredFromThread(clientThreadId)
        if (brokerAgent.checkTopics(topicNumber, true)) {
          let result = await contract.submitTransaction('publishToTopic', topicNumber, newMessage)
          let resultJSON = JSON.parse(result.toString())
          response = resultJSON.message
        }
        else {
          response = 'The agent is not permitted to publish to this topic'
        }
      }
    })

    res.status(200).json({ message: authMessage ? authMessage : response })

  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to publish to topic: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will give client permission to read an existed topic in HF ledger
 */
app.post('/subscribeToTopic', async function (req, res) {
  try {

    let { topicNumber, clientDid, clientThreadId } = req.body
    let response

    let authMessage = await auth(clientDid, async () => {
      let result = await contract.evaluateTransaction('queryTopic', topicNumber)
      let resultJSON = JSON.parse(result.toString())

      // check whether the topic is existed in HF ledger or not
      if(resultJSON.message && resultJSON.message == `${topicNumber} does not exist`) {
        response = resultJSON.message
      }
      else {
        // if the client is not permitted to read the topic then give them the permission
        await brokerAgent.setCurrCredFromThread(clientThreadId)
        if(!brokerAgent.checkTopics(topicNumber, false)) {
          await brokerAgent.sendMessage('Issuing new Credentials...')
          await brokerAgent.issueCredential(topicNumber, false)
          response = `Successfully subscribe to ${topicNumber}`
        }
        else {
          response = `Already subscribe to ${topicNumber}`
        }
      }
    })

    res.status(200).json({ message: authMessage ? authMessage : response })
  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to publish to topic: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will get all topics in HF ledger that the client allowed to read
 */
app.post('/queryAllTopics', async function (req, res) {
  try {

    let { clientDid, clientThreadId } = req.body
    let response
    
    let authMessage = await auth(clientDid, async () => {
        await brokerAgent.setCurrCredFromThread(clientThreadId)
        let topics = brokerAgent.getAllTopics()
        let allRecords = []
        for (let topic of topics) {
            let record = await contract.evaluateTransaction('queryTopic', topic)
            allRecords.push({ key: topic, record: JSON.parse(record.toString()) })
        }
        response = allRecords
    })

    res.status(200).json(authMessage ? authMessage : response)

  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to query all topics: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will get all existed topics currently in HF ledger
 * (ONLY USE FOR DEVELOPING AND TESTING PURPOSE)
 */
 app.get('/queryAllTopics', async function (req, res) {
  try {

    const result = await contract.evaluateTransaction('queryAllTopics')
    res.status(200).json(JSON.parse(result.toString()))

  }
  catch (error) {
    res.status(500).json({ errorMessage: `Failed to query all topics: ${error}` })
  }
  finally {
    // Disconnect from the HF gateway.
    await gateway.disconnect()
  }
})

/**
 * This function will delete all existed credentials and connections in HA agent
 * (ONLY USE FOR DEVELOPING AND TESTING PURPOSE)
 */
 app.get('/clearAll', async function (req, res) {

  // get a list of all existed credentials
  let credentialRecords = await brokerAgent.agent.credentials.getAll()

  // delete all existed credentials
  credentialRecords.forEach(async element => {
    await brokerAgent.agent.credentials.deleteById(element.id)
  })

  // get a list of all existed connections
  let connectionRecords = await brokerAgent.agent.connections.getAll()

  // delete all existed connections
  connectionRecords.forEach(async element => {
    await brokerAgent.agent.connections.deleteById(element.id)
  })

  res.status(200).json({ message: 'All credentials and connections are cleared' })
})

app.listen(3000, async function () {
  try {
    await setUp()
    console.log('Broker is listening')
  }
  catch (error) {
    console.log(`Failed to bring up broker: ${error}`)
    process.exit(1)
  }
})