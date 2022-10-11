terraform {
  backend "gcs" {
    bucket = "app-dev-terraform-states"
    prefix = "dev"
  }
  required_providers {
    google-beta = {
      version = "~>4.26.0"
    }
  }
}

provider "google" {
  project = "app-website-dev"
  region  = "us-central1"
}

locals {
  settings = {
    universe_id           = "dev"
    environment           = "dev"
    project               = "app-website"
    project_id            = "app-website-dev"
    region                = "us-central1"
    create_domain_mapping = false

    # Tune at will
    max_instance_count             = 1
    min_instance_count             = 0
    available_memory               = "256M"
    timeout_seconds                = 60
    all_traffic_on_latest_revision = true

    service = {
      concurrency = 100
      cpu         = 1
    }
  }
}

module "app" {
  source   = "../../app"
  settings = local.settings
}
