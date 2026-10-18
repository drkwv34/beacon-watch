import type { DisplayStatus } from '@beacon-watch/domain';

export interface PublicTarget {
  id: string;
  name: string;
  url: string;
  method: string;
  interval_seconds: number;
  timeout_ms: number;
  expected_status: number;
  headers: Record<string, string> | null;
  body: string | null;
  grace_threshold: number;
  recovery_threshold: number;
  enabled: boolean;
  is_public: boolean;
  public_slug: string | null;
  last_status: DisplayStatus;
  last_checked_at: string | null;
  latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface PublicCheck {
  id: string;
  checked_at: string;
  success: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
}

export interface PublicIncident {
  id: string;
  status: 'open' | 'resolved';
  opened_at: string;
  resolved_at: string | null;
  duration_seconds: number;
}

export interface PublicStatusPage {
  name: string;
  status: DisplayStatus;
  last_checked_at: string | null;
  latency_ms: number | null;
  uptime_24h: number | null;
  open_incident: { opened_at: string; duration_seconds: number } | null;
  check_count: number;
  ever_succeeded: boolean;
  recent_incidents: Array<{
    opened_at: string;
    resolved_at: string | null;
    duration_seconds: number;
    status: 'open' | 'resolved';
  }>;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: { fields?: Record<string, string>; field?: string };
  };
}
