import { createContext, useContext, ReactNode } from 'react';
import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { apiClient, PrometheusConfig } from '@/lib/api';
import { useCluster } from '@/contexts/ClusterContext';

interface ConfigContextType {
  config: PrometheusConfig | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<QueryObserverResult<PrometheusConfig | undefined, Error>>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { selectedClusterId } = useCluster();
  const { data: config, isLoading, error, refetch } = useQuery({
    queryKey: ['config', selectedClusterId],
    queryFn: () => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.getConfig(selectedClusterId);
    },
    enabled: !!selectedClusterId,
    staleTime: 60_000,
  });

  return (
    <ConfigContext.Provider
      value={{
        config,
        isLoading,
        error: error as Error | null,
        refetch,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
