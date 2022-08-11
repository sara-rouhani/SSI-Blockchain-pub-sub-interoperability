# Summer-2022-Blockchain-lab

### This project attempt to build secure interactions between blockchain networks. We use [Hyperledger Fabric](https://hyperledger-fabric.readthedocs.io/en/release-2.2/) (HF) for blockchain networks and [Hyperledger Aries](https://github.com/hyperledger/aries) (HA) for Self Soverign Identity (SSI)

## Getting Started

### Prerequisites

**Install cURL**  
Download the latest version of the [cURL](https://curl.se/download.html) tool if it is not already installed or if you get errors running the curl commands

**Install Docker and Docker Compose**
* [Docker](https://www.docker.com/products/docker-desktop/) version 17.06.2-ce or greater is required
* [Docker Compose](https://docs.docker.com/compose/install/) version 1.14.0 or greater is required

**Install Go Programming Language**  
[Go](https://go.dev/dl/) version 1.14 or greater is required

**Install NodeJS and npm**
* [NodeJS](https://nodejs.org/en/download/) version 12.22.12 or greater is required
* [npm](https://nodejs.org/en/download/) version 7.5.2 or greater is required

### Bring up HF blockchain
**Install Binaries and Docker Images**
* Move to the directory of the network you want to bring up:
    * Broker Network 
        ```
        cd aries-broker/
        ```
    * Client Network
        ```
        cd aries-client/
        ```
* Once you are in the directory of the network you are going to bring up, execute the command to pull down the binaries and images
    ```
    curl -sSL https://bit.ly/2ysbOFE | bash -s
    ```

**Bring up blockchain network**  
After Brinaries and Docker Images are installed, you can go ahead and bring up the network by moving to `blockchain-client/` directory and execute the following commands:
* Broker Network
    ```
    /.startFabric.sh javascript
    ```
* Client Network
    ```
    /.startFabric.sh javascript
    ```
### Install Nodejs dependencies
Since this project is fully written in Javascript and Typescript, you need to install all required NodeJS dependencies by moving to `javascript/` directory and execute the following command:
```
npm install
```