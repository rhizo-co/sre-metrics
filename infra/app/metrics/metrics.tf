resource "google_logging_metric" "action_latency_metric" {
  name   = "action-latency"
  filter = "resource.type=cloud_function AND actionLatency"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
    display_name = "Action Latency"
  }
  value_extractor = "REGEXP_EXTRACT(jsonPayload.message, \d+)"
}

resource "google_logging_metric" "validation_latency_metric" {
  name   = "validation_latency"
  filter = "resource.type=cloud_function AND validationLatency"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "ms"
    display_name = "Validation Latency"
  }
}

resource "google_logging_metric" "error_count_metric" {
  name   = "error_count"
  filter = "resource.type=cloud_function AND errorCount"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Error Count"
  }
}

resource "google_logging_metric" "incorrect_answer_count_metric" {
  name   = "validation_latency"
  filter = "resource.type=cloud_function AND incorrectAnswer"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Incorrect answer Count"
  }
}

resource "google_monitoring_alert_policy" "error_alert_policy" {
  display_name = "Error Count Alert Policy"
  combiner     = "OR"
  conditions {
    display_name = "test condition"
    condition_threshold {
      filter     = "metric.type=\"logging.googleapis.com/user/error_count\" AND resource.type=\"cloud_function\""
      duration   = "60s"
      comparison = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
}

