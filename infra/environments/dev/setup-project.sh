#!/usr/bin/env bash

# make bash play nicely
set -euo pipefail

# Create the bucket
gsutil mb -p "app-website-dev" gs://app-dev-terraform-states

# Enable the credentials API
gcloud --project "app-website-dev" services enable serviceusage.googleapis.com
gcloud --project "app-website-dev" services enable cloudbuild.googleapis.com
gcloud --project "app-website-dev" services enable cloudfunctions.googleapis.com
gcloud --project "app-website-dev" services enable pubsub.googleapis.com
gcloud --project "app-website-dev" services enable logging.googleapis.com
gcloud --project "app-website-dev" services enable run.googleapis.com
gcloud --project "app-website-dev" services enable artifactregistry.googleapis.com
