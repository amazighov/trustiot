import * as grpc from '@grpc/grpc-js';

import {
  connect,
  hash,
  signers
} from '@hyperledger/fabric-gateway';

import {
  readFile,
  readdir
} from 'node:fs/promises';

import path from 'node:path';
import crypto from 'node:crypto';

export class FabricGatewayAdapter {
  constructor({
    channelName = process.env.FABRIC_CHANNEL || 'mychannel',
    chaincodeName = process.env.FABRIC_CHAINCODE || 'trustiot',
    mspId = process.env.FABRIC_MSP_ID || 'Org1MSP',
    peerEndpoint = process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    peerHostAlias =
      process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.org1.example.com',
    cryptoPath = process.env.FABRIC_CRYPTO_PATH
  } = {}) {
    this.channelName = channelName;
    this.chaincodeName = chaincodeName;
    this.mspId = mspId;
    this.peerEndpoint = peerEndpoint;
    this.peerHostAlias = peerHostAlias;
    this.cryptoPath = cryptoPath;

    this.client = null;
    this.gateway = null;
    this.contract = null;
  }

  async connect() {
    if (!this.cryptoPath) {
      throw new Error('FABRIC_CRYPTO_PATH is required');
    }

    const userMspPath = path.join(
      this.cryptoPath,
      'users',
      'User1@org1.example.com',
      'msp'
    );

    const signcertDirectory = path.join(
      userMspPath,
      'signcerts'
    );

    const keyDirectory = path.join(
      userMspPath,
      'keystore'
    );

    const tlsCertPath = path.join(
      this.cryptoPath,
      'peers',
      'peer0.org1.example.com',
      'tls',
      'ca.crt'
    );

    const certFiles = await readdir(
      signcertDirectory
    );

    if (certFiles.length === 0) {
      throw new Error(
        'No Fabric certificate found'
      );
    }

    const keyFiles = await readdir(
      keyDirectory
    );

    if (keyFiles.length === 0) {
      throw new Error(
        'No Fabric private key found'
      );
    }

    const certificate = await readFile(
      path.join(
        signcertDirectory,
        certFiles[0]
      )
    );

    const privateKeyPem = await readFile(
      path.join(
        keyDirectory,
        keyFiles[0]
      )
    );

    const tlsRootCert = await readFile(
      tlsCertPath
    );

    const credentials =
      grpc.credentials.createSsl(
        tlsRootCert
      );

    const client = new grpc.Client(
      this.peerEndpoint,
      credentials,
      {
        'grpc.ssl_target_name_override':
          this.peerHostAlias
      }
    );

    const identity = {
      mspId: this.mspId,
      credentials: certificate
    };

    const privateKey =
      crypto.createPrivateKey(
        privateKeyPem
      );

    const signer =
      signers.newPrivateKeySigner(
        privateKey
      );

    const gateway = connect({
      client,
      identity,
      signer,
      hash: hash.sha256
    });

    this.client = client;
    this.gateway = gateway;

    const network =
      gateway.getNetwork(
        this.channelName
      );

    this.contract =
      network.getContract(
        this.chaincodeName
      );

    return this;
  }

  async registerDataset(dataset) {
    if (!this.contract) {
      throw new Error(
        'Fabric Gateway is not connected'
      );
    }

    const proposal =
  this.contract.newProposal(
    'RegisterDataset',
    {
      arguments: [
        dataset.datasetId,
        dataset.deviceId,
        dataset.ownerOrg,
        dataset.cid ?? '',
        dataset.storageRef ?? '',
        dataset.ciphertextSha256,
        dataset.startedAt,
        dataset.endedAt,
        String(dataset.readingCount),
        dataset.schemaVersion,
        dataset.signerId ?? '',
        dataset.signedAt ?? '',
        dataset.nonce ?? '',
        dataset.signature ?? '',
        dataset.signatureAlgorithm ?? '',
        dataset.storageDriver ?? '',
dataset.encryption ?? '',
dataset.createdAt ?? ''
      ]
    }
  );
          
        
      

    const transaction =
      await proposal.endorse();

    const transactionId =
      transaction.getTransactionId();

    const result =
      transaction.getResult();

    const submittedTransaction =
      await transaction.submit();

    const status =
      await submittedTransaction.getStatus();

    if (!status.successful) {
      throw new Error(
        `Fabric transaction ${transactionId} failed with code ${status.code}`
      );
    }

    return {
      transactionId,
      record: JSON.parse(
        Buffer.from(result)
          .toString('utf8')
      )
    };
  }

  async readDataset(datasetId) {
    if (!this.contract) {
      throw new Error(
        'Fabric Gateway is not connected'
      );
    }

    const result =
      await this.contract
        .evaluateTransaction(
          'ReadDataset',
          datasetId
        );

    return JSON.parse(
      Buffer.from(result)
        .toString('utf8')
    );
  }

  async setVerificationStatus(
    datasetId,
    status
  ) {
    if (!this.contract) {
      throw new Error(
        'Fabric Gateway is not connected'
      );
    }

    const result =
      await this.contract
        .submitTransaction(
          'SetVerificationStatus',
          datasetId,
          status
        );

    return JSON.parse(
      Buffer.from(result)
        .toString('utf8')
    );
  }
  async datasetExists(datasetId) {
  const result =
    await this.contract.evaluateTransaction(
      'DatasetExists',
      datasetId
    );

  return Buffer.from(result)
    .toString('utf8')
    .trim() === 'true';
}

  close() {
    this.gateway?.close();
    this.client?.close();

    this.gateway = null;
    this.client = null;
    this.contract = null;
  }
}