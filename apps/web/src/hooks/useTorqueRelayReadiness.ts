"use client";

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiUrl";

export type TorqueRelayReadiness = {
  configured: boolean;
  relayMode: "torque_ingest";
  ingestHost: string | null;
  eventNames: string[];
  requiredSchemas: Array<{
    eventName: string;
    name: string;
    fields: string[];
  }>;
  suggestedCampaigns: Array<{
    name: string;
    objective: string;
  }>;
  mcpQuickstart: {
    codexCommand: string;
    cursorConfigPath: string;
    toolSequence: string[];
  };
  campaignBlueprints: Array<{
    name: string;
    type: string;
    interval: string;
    eventName: string;
    valueExpression: string;
    filters: string[];
    customFormula?: string;
    rebatePercentage?: number;
  }>;
  frictionLog: string[];
  summary: string;
};

async function fetchTorqueRelayReadiness(): Promise<TorqueRelayReadiness> {
  const res = await fetch(`${API_URL}/api/integrations/torque/readiness`, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Torque readiness API error: ${res.status}`);
  return body.data as TorqueRelayReadiness;
}

export function useTorqueRelayReadiness() {
  return useQuery({
    queryKey: ["torque-relay-readiness"],
    queryFn: fetchTorqueRelayReadiness,
    retry: 1,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
}
