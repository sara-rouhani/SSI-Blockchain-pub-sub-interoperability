/**
 * REMARKS: Hyperledger Aries Agent specified for working with Broker functionalities
 */

import {  ConnectionRecord, CredentialEventTypes, CredentialExchangeRecord, 
          CredentialState, CredentialStateChangedEvent, ProofEventTypes, 
          ProofRecord, ProofState, ProofStateChangedEvent, 
          V1CredentialPreview, AttributeFilter, ProofAttributeInfo, utils } from '@aries-framework/core'

import type { CredDef, Schema } from 'indy-sdk'

import fetch from 'node-fetch'

import { BaseAgent } from './BaseAgent'
import { Color, greenText, Output, purpleText, redText } from './OutputClass'

export class BrokerAgent extends BaseAgent {
  public connectionRecordClientId?: string                // information about current client's connection
  public credentialDefinition?: CredDef                   // current credential definition that will be offered to client
  public currentCredRecord?: CredentialExchangeRecord     // credential of current connected client

  public constructor(ipAddr: string, port: number, name: string) {
    super(ipAddr, port, name)
  }

  /**
   * This function will create a HA agent with specific configuration
   * 
   * @returns {BrokerAgent} A HA agent
   */
  public static async build(): Promise<BrokerAgent> {
    let response = await fetch('https://api.ipify.org/?format=json').then(results => results.json())

    const broker = new BrokerAgent(response.ip, 9000, 'broker')
    await broker.initializeAgent()
    return broker
  }

  /**
   * This function will receive and parse connecting invitation from client 
   * 
   * @param invitationUrl invitation url sent by client
   * @returns {ConnectionRecord} connection record of the connecting client
   */
  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl)
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  /**
   * This function will wait when the connection is established with the client
   * 
   * @param connectionRecord connection record of the connecting client
   * @returns {string} id of the connected client
   */
  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    console.log(greenText("\n"+Output.ConnectionEstablished+"\n"))
    return connectionRecord.id
  }

  /**
   * This function will accept the connecting request from client and wait until connection is established
   * 
   * @param invitation_url invitation url sent by client
   */
  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordClientId = await this.waitForConnection(connectionRecord)
  }

  /**
   * This function will print schema of the offering credential
   * 
   * @param schemaTemplate credential's schema
   */
  private printSchema(schemaTemplate: any) {
    console.log(`\n\nThe credential definition will look like this:\n`)
    for (let attribute in schemaTemplate) {
      console.log(purpleText(`${attribute}: ${Color.Reset}${schemaTemplate[attribute]}`))
    }
  }

  /**
   * This function will register credential's schema
   * 
   * @returns {Schema} registered credential's schema
   */
  private async registerSchema() {
    const schemaTemplate = {
      name: `BrokerAgent(${utils.uuid()})`,
      version: '1.0.0',
      attributes: ['id', 'publishedTopics', 'subscribedTopics'],
    }
    this.printSchema(schemaTemplate)
    const schema = await this.agent.ledger.registerSchema(schemaTemplate)
    return schema
  }

  /**
   * This function will register definition for credential's schema
   * 
   * @param schema credential's schema that need to be define
   * @returns {CredDef} definition for the schema
   */
  private async registerCredentialDefinition(schema: Schema) {
    this.credentialDefinition = await this.agent.ledger.registerCredentialDefinition({
      schema,
      tag: 'latest',
      supportRevocation: false,
    })
    return this.credentialDefinition
  }

  /**
   * This function will create a credential definition for this agent if it does not have one
   * 
   * @returns {CredDef} Credential Definition
   */
  private async getCreDef() {
    if(!this.credentialDefinition) {
      let schema = await this.registerSchema()
      this.credentialDefinition = await this.registerCredentialDefinition(schema)
    }
    return this.credentialDefinition
  }

  /**
   * This function will create a new credential with new topic added to client's current credential
   * 
   * @param newTopic the topic that will be added to client's credential
   * @param create whether the new topic is just created or already existed
   * @returns {V1CredentialPreview} new credential that will be offered to client
   */
  private getCredentialPreview(newTopic?: string, create?: boolean) {
    let currId, currPubTopics, currSubTopics

    // check whether client already has credential or not
    if (this.currentCredRecord?.credentialAttributes && newTopic) {
      currId = this.currentCredRecord.credentialAttributes[0].value
      currPubTopics = this.currentCredRecord.credentialAttributes[1].value
      currSubTopics = this.currentCredRecord.credentialAttributes[2].value

      // add new topic to client's list of subscribed topics
      if (this.currentCredRecord.credentialAttributes[2].value !== '')
        currSubTopics = this.currentCredRecord.credentialAttributes[2].value + ',' + newTopic
      else
        currSubTopics = newTopic

      // add new topic to client's list of created topics
      if (create) {
        if (this.currentCredRecord.credentialAttributes[1].value !== '')
          currPubTopics = this.currentCredRecord.credentialAttributes[1].value + ',' + newTopic
        else
          currPubTopics = newTopic
      }
    }
    else {
      currId = utils.uuid()
      currPubTopics = ''
      currSubTopics = ''
    }

    const credentialPreview = V1CredentialPreview.fromRecord({
      id: currId,
      publishedTopics: currPubTopics,
      subscribedTopics: currSubTopics
    })
    return credentialPreview
  }

  /**
   * This function will get record of current connected client
   * 
   * @returns {ConnectionRecord} client's connection record
   */
  private async getConnectionRecord() {
    if (!this.connectionRecordClientId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordClientId)
  }

  /**
   * This function will offer connected client new credential
   * 
   * @param newTopic the new topic that will be added in this new credential
   * @param create whether the topic is just created or already existed
   * @returns {boolean} whether client accept the offered credential or not
   */
  public async issueCredential(newTopic?: string, create?: boolean) {
    const credDef = await this.getCreDef()
    const credentialPreview = this.getCredentialPreview(newTopic, create)
    const connectionRecord = await this.getConnectionRecord()

    await this.agent.credentials.offerCredential({

      connectionId: connectionRecord.id,
      protocolVersion: 'v1',
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: credDef.id,
        },
      },
    })

    return await this.credentialAcceptedListener()
  }

  private async printProofFlow(print: string) {
    console.log(print)
    await new Promise((f) => setTimeout(f, 20000))
  }

  /**
   * This function will create information about the information that need to be proved from client
   * 
   * @param attributeName attribute that need to be proved
   * @returns {ProofAttributeInfo} information about the attribute that will be proved
   */
  private async newProofAttribute(attributeName: string) {
    await this.printProofFlow(greenText(`Creating new proof attribute for ` + attributeName + ` ...\n`))
    const proofAttribute = {
      attribute: new ProofAttributeInfo({
        name: attributeName,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: this.credentialDefinition?.id,
          }),
        ],
      }),
    }
    return proofAttribute
  }

  /**
   * This function will send request to client for the proof or an attribute 
   * 
   * @param attributeName attribute that need to be proved by client
   * @returns {ProofRecord} status of the proof after the response from client
   */
  public async sendProofRequest(attributeName: string) {
    const connectionRecord = await this.getConnectionRecord()
    const proofAttribute = await this.newProofAttribute(attributeName)
    console.log(greenText('Requesting proof...', false))
    let proofRecord = await this.agent.proofs.requestProof(connectionRecord.id, {
      requestedAttributes: proofAttribute,
    })

    return await this.proofAcceptedListener(proofRecord)
  }

  /**
   * This function will listen to client's response for the proof request
   * 
   * @param proofRecord the proof that client need to provide
   * @returns {ProofRecord} status of the proof after the response from client
   */
  public async proofAcceptedListener(proofRecord: ProofRecord) {
    const getProofRecord = () =>
      new Promise<ProofRecord>((resolve, reject) => {
        console.log(greenText('Waiting for proof to be accepted'))
        const timeoutId = setTimeout(() => resolve(proofRecord), 7000)
        this.agent.events.on<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged, (e) => {
          if (e.payload.proofRecord.state == ProofState.Done && e.payload.proofRecord.connectionId === this.connectionRecordClientId) return
          clearTimeout(timeoutId)
          resolve(e.payload.proofRecord)
        })
      })
    return await getProofRecord()
  }

  /**
   * This function will listen to client's response for the credential offer 
   * 
   * @returns {boolean} whether the client accept the credential or not
   */
  public async credentialAcceptedListener() {
    let credAccepted = false
    const getCredentialRecord = () =>
      new Promise<CredentialExchangeRecord>((resolve, reject) => {
        console.log(greenText('\nWaiting for credentials to be accepted'))
        // Timeout of 20 seconds
        const timeoutId = setTimeout(() => reject(new Error(redText('No credential record set'))), 20000)

        // Start listener
        this.agent.events.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, (e) => {
          if (e.payload.credentialRecord.state == CredentialState.Done && e.payload.credentialRecord.connectionId === this.connectionRecordClientId) return
          credAccepted = true
          clearTimeout(timeoutId)
          resolve(e.payload.credentialRecord)
        })

      })

    let credRecord = await getCredentialRecord()
    if (credAccepted) {
      this.currentCredRecord = credRecord
      console.log('Credentials accepted')
    }

    return credAccepted
  }

  /**
   * This function will check if the client allowed to read or modify a topic
   * 
   * @param checkTopic topic that will be checked
   * @param modify client try to modify the topic or not
   * @returns {boolean} whether client's action is allowed or not
   */
  public checkTopics(checkTopic: string, modify?: boolean) {
    let flag = false
    if (this.currentCredRecord?.credentialAttributes) {
      let topics
      if (modify) {
        topics = this.currentCredRecord?.credentialAttributes[1].value.split(',')
      }
      else {
        topics = this.currentCredRecord?.credentialAttributes[2].value.split(',')
      }
      if (topics.includes(checkTopic))
        flag = true
    }
    return flag
  }

  /**
   * This function will get all topics that the client allowed to read
   * 
   * @returns {string[]} list of topics that the client allowed to read
   */
  public getAllTopics() {
    let topics: string[] = []
    if (this.currentCredRecord?.credentialAttributes) {
      if(this.currentCredRecord?.credentialAttributes[2].value != '') {
        topics = this.currentCredRecord?.credentialAttributes[2].value.split(',')
      }
    }
    return topics
  }

  /**
   * This function will get the credenttial of the current connected client
   * 
   * @param threadId threadId provided by client
   */
  public async setCurrCredFromThread(threadId: string) {
    let allRecords = await this.agent.credentials.getAll()
    allRecords.forEach(async element => {
      if (element.threadId == threadId) {
        return this.currentCredRecord = element
      }
    })
  }

  /**
   * This function will send a message to current connected client
   * 
   * @param message message that will be sent to the client
   */
  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
  }
}
