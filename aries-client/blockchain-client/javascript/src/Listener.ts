/**
 * REMARKS: Listener for Broker's agent
 */

import type {
  BasicMessageStateChangedEvent,
  CredentialExchangeRecord,
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
} from '@aries-framework/core'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import type { ClientAgent } from './ClientAgent'

import {
  BasicMessageEventTypes,
  BasicMessageRole,
  CredentialEventTypes,
  CredentialState,
  ProofEventTypes,
  ProofState,
} from '@aries-framework/core'
import { ui } from 'inquirer'

import { Color, purpleText } from './OutputClass'

export class Listener {
  public on: boolean        // whether connected to Broker's agent or not
  private ui: BottomBar

  public constructor() {
    this.on = false
    this.ui = new ui.BottomBar()
  }

  private turnListenerOn() {
    this.on = true
  }

  private turnListenerOff() {
    this.on = false
  }

  /**
   * This function previews the received credential
   * 
   * @param credentialRecord credential record to be previewed
   */
  private printCredentialAttributes(credentialRecord: CredentialExchangeRecord) {
    if (credentialRecord.credentialAttributes) {
      const attribute = credentialRecord.credentialAttributes
      console.log('\n\nCredential preview:')
      attribute.forEach((element) => {
        console.log(purpleText(`${element.name} ${Color.Reset}${element.value}`))
      })
    }
  }



  /**
   * This function listening for credential offered by Broker's agent
   * 
   * @param clientAgent client's agent
   */
  public credentialOfferListener(clientAgent: ClientAgent) {
    clientAgent.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.RequestSent) {
          this.printCredentialAttributes(payload.credentialRecord)
        }
      }
    )
  }

  /**
   * This function listening for message sent by Broker's agent
   * 
   * @param clientAgent client's agent
   */
  public messageListener(clientAgent: ClientAgent) {
    clientAgent.agent.events.on(
      BasicMessageEventTypes.BasicMessageStateChanged, 
      async ({ payload }: BasicMessageStateChangedEvent) => {
        if (payload.basicMessageRecord.role === BasicMessageRole.Receiver) {
          this.turnListenerOn()
          this.ui.updateBottomBar(purpleText(`message: ${payload.message.content}\n`))
          this.turnListenerOff()
        }
      }
    )
  }

  /**
   * This function listening for proof requested by Broker's agent
   * 
   * @param clientAgent client's agent
   */
  public proofRequestListener(clientAgent: ClientAgent) {
    clientAgent.agent.events.on(
      ProofEventTypes.ProofStateChanged, 
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.RequestReceived  && payload.proofRecord.connectionId === (await clientAgent.getConnectionRecord()).id) {
          this.turnListenerOn()
          console.log(purpleText('Getting verified'))
          await clientAgent.acceptProofRequest(payload.proofRecord)
          this.turnListenerOff()
        }
      }
    )
  }

}
