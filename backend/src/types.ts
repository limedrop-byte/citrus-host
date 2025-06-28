export interface SiteOperation {
  agentId: string;
  operation: 'create' | 'delete' | 'deploy_ssl' | 'turn_off_ssl' | 'redeploy_ssl';
  status: 'starting' | 'completed' | 'failed' | 'deleted' | 'deleting' | 
          'ssl_deploying' | 'ssl_deactivating' | 'ssl_redeploying';
  domain: string;
  error?: string;
}

export type SSLStatus = 'active' | 'inactive' | 'pending' | 'error'; 