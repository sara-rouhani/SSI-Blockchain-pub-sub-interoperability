/**
 * REMARKS: Perform client's functionalities by using Hyperledger Fabric chaincode and RESTFUL API to connect with Broker server
 */

'use strict';

const {connect} = require('./connectUtil');
const brokerApi = require('../broker-api/brokerApi');

class TopicClient {

  channelName = 'mychannel';
  chaincodeName = 'topic';

  static async build(connectConfig) {
    const clientApi = new TopicClient();
    clientApi.gateway = await connect(connectConfig);
    return clientApi;
  }

  /**
   * This function will send request to Broker server to connect client's agent with Broker's agent
   * 
   * @param {*} args data that is needed for connecting with Broker's agent
   * @returns response message from Broker server
   */
  async connectToAgent(args) {
    try {
      let res = await brokerApi.connectToAgent(args);
      return res;
    }
    catch (err) {
      console.log(err)
    }
  }

  /**
   * This function will send request to Broker server to create new topic on Broker's ledger 
   * 
   * @param {*} args data that is needed for creating new topic on Broker's ledger
   * @returns response message from Broker server
   */
  async createTopic(args) {
    try {
      // Get the network (channel) our contract is deployed to.
      let network = await this.gateway.getNetwork(this.channelName);
  
      // Get the contract from the network.
      let contract = network.getContract(this.chaincodeName);
  
      let res = await brokerApi.createTopic(args);
      if(res.message === `${args.topicNumber} is created`){
        await contract.submitTransaction('createTopic', args.topicNumber);
      }
      return res;
    }
    catch (err) {
      console.log(err);
    }
  }
  
  /**
   * This function will send request to Broker server to query an existed topic on Broker's ledger
   * 
   * @param {*} args data that is needed for querying an existed topic on Broker's ledger
   * @returns topic's data on Broker's ledger
   */
  async queryTopic(args) {
    try {
      let response = await brokerApi.queryTopic(args)
      return response;
    }
    catch (err) {
      console.log(err);
    }
  }

  /**
   * This function will send request to Broker server to query all topics that the client allowed to read on Broker's ledger
   * 
   * @param {*} args data that is needed for querying all topics that the client allowed to read on Broker's ledger
   * @returns all topics' data that the client allowed to read on Broker's ledger
   */
  async queryAllTopics(args) {
    try {
      let response = await brokerApi.queryAllTopics(args)
      return response;
    }
    catch (err) {
      console.log(err);
    }
  }
  
  /**
   * This function will send multiple requests to Broker server to query all topics that are created by the client on Broker's ledger
   * 
   * @param {*} args data that is needed for querying a topic created by this client on Broker's ledger
   * @returns all topics' data created by the client on Broker's ledger
   */
  async queryCreatedTopics(args) {
    try {
      // Get the network (channel) our contract is deployed to.
      let network = await this.gateway.getNetwork(this.channelName);
  
      // Get the contract from the network.
      let contract = network.getContract(this.chaincodeName);
  
      // Get all topics on client's ledger
      let allTopics = await contract.evaluateTransaction('queryAllTopics');
  
      allTopics = JSON.parse(allTopics);

      // for each topic on client's ledger send a request to query its data on Broker's ledger
      for (let topic of allTopics) {
        Object.assign(args, {topicNumber: topic.key})
        topic.record = await this.queryTopic(args);
      }
  
      return allTopics;
    }
    catch (err) {
      console.log(err);
    }
  }
  
  /**
   * This function will send request to Broker server to modify an existed topic on Broker's ledger
   * 
   * @param {*} args data that is needed for modifying an existed topic on Broker's ledger
   * @returns response message from Broker server
   */
  async publishToTopic(args) {
    try {  
      let response = await brokerApi.publishToTopic(args);  
      return response;
    }
    catch (err) {
      console.log(err);
    }
  }

  /**
   * This function will send request to Broker server to subscribe to an existed topic on Broker's ledger
   * 
   * @param {*} args data that is needed for subscribing to an existed topic on Broker's ledger
   * @returns response message from Broker server
   */
  async subscribeToTopic(args) {
    try {
      let response = await brokerApi.subscribeToTopic(args)
      return response;
    }
    catch (err) {
      console.log(err);
    }
  }

  async disconnect() {
    await this.gateway.disconnect();
  }
}

module.exports = TopicClient;