terraform {
  required_providers {
    google-beta = {
      version = "~>4.26.0"
    }
  }
}

# Bucket to host the code
resource "google_storage_bucket" "deployments" {
  name                        = "bobsled-${var.settings.environment}-${var.settings.project}-deploy"
  location                    = "US"
  uniform_bucket_level_access = true
}
resource "google_storage_bucket_object" "build" {
  lifecycle {
    create_before_destroy = true
  }
  name   = "${local.dist.output_sha}.zip"
  bucket = google_storage_bucket.deployments.name
  source = local.dist.zip_file
}

# Deploy function
resource "google_cloudfunctions2_function" "deploy" {
  provider = google-beta
  project  = var.settings.project_id
  name     = "${var.settings.environment}-${var.settings.project}"
  location = var.settings.region

  build_config {
    runtime     = "nodejs16"
    entry_point = "remixApp"
    source {
      storage_source {
        bucket = google_storage_bucket.deployments.name
        object = google_storage_bucket_object.build.name
      }
    }
  }

  service_config {
    service_account_email          = data.google_service_account.website_service_account.email
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = var.settings.all_traffic_on_latest_revision
    max_instance_count             = var.settings.max_instance_count
    min_instance_count             = var.settings.min_instance_count
    available_memory               = var.settings.available_memory
    timeout_seconds                = var.settings.timeout_seconds
  }
}

# Grant public access
data "google_cloud_run_service" "run_service" {
  depends_on = [google_cloudfunctions2_function.deploy]
  name       = google_cloudfunctions2_function.deploy.name
  location   = var.settings.region
}
resource "google_cloud_run_service_iam_member" "binding" {
  location = var.settings.region
  project  = var.settings.project_id
  service  = data.google_cloud_run_service.run_service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

data "google_service_account" "website_service_account" {
  account_id = "website-service-account-${var.settings.universe_id}"
  project    = var.settings.project_id
}

locals {
  dist = {
    zip_file   = "${path.module}/../../dist.zip"
    output_sha = filesha256("${path.module}/../../dist.zip")
  }
}

# Modify the Cloud Run Service with changes we want:

# A) Set service concurrency.
#
# The reason behind this hack is that
# we want to update only two parameter of the service, without having to manage
# the whole config
resource "null_resource" "service_update" {
  depends_on = [google_cloudfunctions2_function.deploy, data.google_cloud_run_service.run_service]
  triggers = {
    id          = data.google_cloud_run_service.run_service.id
    source_hash = local.dist.output_sha # probably overkill. Better have too much updates than too few, though
  }
  provisioner "local-exec" {
    command = <<EOT
    gcloud run services update ${data.google_cloud_run_service.run_service.name} \
      --project ${var.settings.project_id} \
      --region ${var.settings.region} \
      --cpu ${var.settings.service.cpu} \
      --concurrency ${var.settings.service.concurrency} \
      --no-use-http2 
    EOT
  }
}

resource "google_cloud_run_domain_mapping" "default" {
  count = var.settings.create_domain_mapping ? 1 : 0

  location = var.settings.region
  name     = var.settings.domain_mapping

  metadata {
    namespace = var.settings.project_id
  }
  spec {
    route_name = data.google_cloud_run_service.run_service.name
  }
}
