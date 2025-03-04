/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */

declare module "sst" {
  export interface Resource {
    "AIVEN_TOKEN": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "ChatSite": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
    "GOOGLE_GENERATIVE_AI_API_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "MyBucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "OurVpc": {
      "bastion": string
      "type": "sst.aws.Vpc"
    }
    "POSTGRES_CONN_URI": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Postgres": {
      "dbName": string
      "type": "sst.sst.Linkable"
    }
    "ScraperTask": {
      "assignPublicIp": boolean
      "cluster": string
      "containers": any
      "securityGroups": any
      "subnets": any
      "taskDefinition": string
      "type": "sst.aws.Task"
    }
    "companyScrapeHandler": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
  }
}
/// <reference path="sst-env.d.ts" />

import "sst"
export {}