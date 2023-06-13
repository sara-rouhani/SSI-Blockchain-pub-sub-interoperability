# SSI integration for blockchain Interoperability based on publish subscribe 

### This project attempt to build secure interactions between blockchain networks. We use Hyperledger Fabric (HF) for blockchain networks and Hyperledger Aries (HA) for Self Sovereign Identity (SSI)

## Getting Started (Debian 11)

### Prerequisites

**Install cURL**  
Download the latest version of the [cURL](https://curl.se/download.html) tool if it is not already installed or if you get errors running the curl commands

**Install Docker and Docker Compose**
* [Docker](https://www.docker.com/products/docker-desktop/) version 17.06.2-ce or greater is required
* [Docker Compose](https://docs.docker.com/compose/install/) version 1.14.0 or greater is required

**Install NodeJS and npm**
* [NodeJS](https://nodejs.org/en/download/) version 12.22.12 or greater is required
* [npm](https://nodejs.org/en/download/) version 7.5.2 or greater is required

**Install indy-sdk**  
Download indy-sdk by following [this instruction](https://aries.js.org/guides/getting-started/installation/nodejs/linux)

### Bring up HF blockchain
**Install Binaries and Docker Images**
* Move to the directory of the network you want to bring up:
   * `aries-broker/` for Broker Network
   * `aries-client/` for Client Network

* Once you are in the directory of the network you are going to bring up, execute the command to pull down the binaries and images
    ```
    curl -sSL https://bit.ly/2ysbOFE | bash -s
    ```

**Bring up blockchain network**  
After Brinaries and Docker Images are installed, you can go ahead and bring up the network by moving to `blockchain-client/` directory and execute `./startFabric.sh javascript`

### Install NodeJS dependencies and run the app
Since this project is written in Javascript and Typescript, you need to install all required NodeJS dependencies by moving to `javascript/` directory and execute `npm install`

## Usage
After all the prerequisites are met, you can start running **Broker** or **Client** with command `npm start`

### Broker
Broker Network is used as a mediator for secure interactions between Client Networks. It issuing and verifying Client Networks' identities, which will make it prossible for data to be exchanged securely on blockchain ledgers.

### Client
Each Client Network will have an identity issued by Broker Network. It can then use this identity to transfer data to other network or get data from other network. The actions perform by this client will be verified based on the issued identity.

**To connect Client to a Broker Server, you need to change variable `brokerServer` in file `aries-client/blockchain-client/broker-api/axiosClient.js` to the domain name or IP address of the corresponding Broker Server**

## More Resources
* [Hyperledger Fabric](https://hyperledger-fabric.readthedocs.io/en/release-2.2/)
* [Hyperledger Aries](https://github.com/hyperledger/aries)
* [Project's paper](https://doi.org/10.1109/IEMCON56893.2022.9946562)

## Authors and Acknowledgement
* Thanks to Professor Sara Rouhani for your guidance
* Thanks to my team members who contributed significantly to this project:
    * Minh Nam Hai Nguyen
    * Sahilpreet Singh Sidhu
    * Chikamnaele Ngene
