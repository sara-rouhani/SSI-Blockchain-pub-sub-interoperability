/**
 * REMARKS: Hyperledger Aries Agent specified for interacting with Broker's Agent
 */

import {
  ConnectionRecord,
  ConnectionStateChangedEvent,
  CredentialExchangeRecord,
  ProofRecord,
  ConnectionEventTypes,
} from '@aries-framework/core'

import fetch from 'node-fetch'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class ClientAgent extends BaseAgent {
  public outOfBandId?: string     // Broker's out of band connection id
  public connected: boolean       // Whether this agent is connected with Broker's agent or not

  public constructor(ipAddr: string, port: number, name: string) {
    super(ipAddr, port, name)
    this.connected = false
  }

  /**
   * This function will create a HA agent with specific configuration
   * 
   * @returns {ClientAgent} A HA agent
   */
  public static async build(): Promise<ClientAgent> {
    let response = await fetch('https://api.ipify.org/?format=json').then(results => results.json())

    const clientAgent = new ClientAgent(response.ip, 9000, 'clientAgent')
    await clientAgent.initializeAgent()
    return clientAgent
  }

  /**
   * This function will generate invitation to connect to this agent
   * 
   * @returns {string} invitation url to connect to this agent
   */
  public async printConnectionInvite() {
    const outOfBand = await this.agent.oob.createInvitation()
    this.outOfBandId = outOfBand.id
    return outOfBand.outOfBandInvitation.toUrl({ domain: `http://localhost:${this.port}` })
  }

  /**
   * This function will wait when the connection is established with the Broker
   */
  public async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord))
    }

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(() => reject(new Error(redText(Output.MissingConnectionRecord))), 20000)

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged, (e) => {
          if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return

          clearTimeout(timeoutId)
          resolve(e.payload.connectionRecord)
        })

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.connections.findAllByOutOfBandId(outOfBandId).then(([connectionRecord]) => {
          if (connectionRecord) {
            clearTimeout(timeoutId)
            resolve(connectionRecord)
          }
        })
      })

    const connectionRecord = await getConnectionRecord(this.outOfBandId)

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
      this.connected = true
    } catch (e) {
      console.log(redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`))
    }
  }

  /**
   * This function will get Broker's connection record
   * 
   * @returns {ConnectionRecord} Broker's connection record
   */
  public async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(this.outOfBandId)

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    return connection
  }

  /**
   * This function will accept credential offered by Broker
   * 
   * @param credentialRecord credential offered by Broker
   */
  public async acceptCredentialOffer(credentialRecord: CredentialExchangeRecord) {
    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    })
  }

  /**
   * This function will accept proof requested by Broker
   * 
   * @param proofRecord proof requested by Broker
   */
  public async acceptProofRequest(proofRecord: ProofRecord) {
    try {
      const retrievedCredentials = await this.agent.proofs.getRequestedCredentialsForProofRequest(proofRecord.id, {
        filterByPresentationPreview: true,
        
      })

      let requestedCredentials = this.agent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
      await this.agent.proofs.acceptRequest(proofRecord.id, requestedCredentials)
      console.log(greenText('\nProof request accepted!\n'))
    }
    catch (error) {
      await this.agent.proofs.declineRequest(proofRecord.id)
      console.log('Verification unsuccessful')
    }
  }

  /**
   * This function will shutdown Client agent and terminate the program
   */
  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
  }
}
