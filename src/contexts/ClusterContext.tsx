import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, Cluster } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'cruisekube-selected-cluster-id';

interface ClusterContextType {
  clusters: Cluster[];
  selectedClusterId: string | null;
  setSelectedClusterId: (clusterId: string | null) => void;
  isLoading: boolean;
  error: Error | null;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [selectedClusterId, setSelectedClusterIdState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
    enabled: isAuthenticated,
  });

  const clusters = Array.isArray(data?.clusters) ? data.clusters : [];

  useEffect(() => {
    if (clusters.length > 0 && !selectedClusterId) {
      const clusterWithStats = clusters.find((c) => c.stats_available);
      const defaultClusterId = clusterWithStats?.id || clusters[0]?.id || null;
      if (defaultClusterId) {
        setSelectedClusterIdState(defaultClusterId);
        localStorage.setItem(STORAGE_KEY, defaultClusterId);
      }
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (selectedClusterId) {
      localStorage.setItem(STORAGE_KEY, selectedClusterId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedClusterId]);

  const setSelectedClusterId = (clusterId: string | null) => {
    setSelectedClusterIdState(clusterId);
  };

  return (
    <ClusterContext.Provider
      value={{
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const context = useContext(ClusterContext);
  if (context === undefined) {
    throw new Error('useCluster must be used within a ClusterProvider');
  }
  return context;
}

