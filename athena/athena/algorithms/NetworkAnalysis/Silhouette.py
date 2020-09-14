import numpy as np
import networkx as nx

# algorithms related to comparing cluster and evaluating cluster quality

# sim is an n by n similarity matrix
# clusters is an n-element array of clsuter assignments of each node
#    References
#    .. [1] `Peter J. Rousseeuw (1987). "Silhouettes: a Graphical Aid to the
#       Interpretation and Validation of Cluster Analysis". Computational
#       and Applied Mathematics 20: 53-65.
#       <http://www.sciencedirect.com/science/article/pii/0377042787901257>`_
#    .. [2] `Wikipedia entry on the Silhouette Coefficient
#           <http://en.wikipedia.org/wiki/Silhouette_(clustering)>`_
def silhouette_score(sim, clusters):
    n_clus = len(np.unique(clusters))
    n_nodes = sim.shape[0]
    if not 1 < n_clus < n_nodes:
        raise ValueError("Number of clusters is %d. Valid values are 2 "
                         "to n_nodes - 1 (inclusive)" % n_clus)
    return np.mean(silhouette_values(sim, clusters))

# Compute the silhouette coefficient for each node or between nodes in two clusters
# sim : array[n_nodes, n_nodes] similarity matrix
# clusters : array[n_nodes] cluster value for each node
def silhouette_values(sim, clusters, cl1, cl2):
    distances = 1 - sim
    n = clusters.shape[0]
    if cl1 != None and cl2 != None:
        mask = (clusters == cl1 or clusters == cl2)
        A = np.array([_intra_cluster_distance(distances[i], clusters, i) for i in range(n) if mask[i] == True])
        B = np.array([_cluster_distance(distances[i], clusters, i, cl2 if clusters[i] == cl1 else cl1) for i in range(n) if mask[i] == True])
    else:
        A = np.array([_intra_cluster_distance(distances[i], clusters, i) for i in range(n)])
        B = np.array([_nearest_cluster_distance(distances[i], clusters, i) for i in range(n)])
    sil = (B - A) / np.maximum(A, B)
    return sil

# calculate the mean intra-cluster distance for node i.
# distances : array[n_nodes]  distances between node i and each node.
# clusters : array[n_nodes] label values for each node
# i : node index
# cl : cluster to compute distance to
def _cluster_distance(distances, clusters, i, cl):
    mask = clusters == cl
    if clusters[i] == cl:
        mask[i] = False
    if not np.any(mask):    # empty mask
        return 0
    a = np.mean(distances[mask])
    return a

# calculate the mean intra-cluster distance for node i.
# distances : array[n_nodes]  distances between node i and each node.
# clusters : array[n_nodes] label values for each node
# i : node index
def _intra_cluster_distance(distances, clusters, i):
    return _cluster_distance(distances, clusters, i, clusters[i])

# calculate the mean nearest-cluster distance for node i.
# distances : array[n_nodes]  distances between node i and each node.
# clusters : array[n_nodes] label values for each node
# i : node index
def _nearest_cluster_distance(distances, clusters, i):
    cl = clusters[i]
    return np.min([np.mean(distances[clusters == clus]) for clus in set(clusters) if not clus == cl])

# calc mean similarity to each cluster
# sim is array[n_nodes] similarity to each node
# clusters is array[n_nodes] of cluster labels
def node_sim_to_cluster(sim, clusters):
    clusters = set(clusters)
    cluster_fit = np.array([np.mean(sim[clusters == clus]) for clus in clusters])
    maxidx = cluster_fit.argmax()
    return (clusters[maxidx], cluster_fit, clusters)

# compute cluster-level silhouette from
# average similarity between nodes in a cluster
# and average similarity between nodes in different clusters
#
def cluster_sil(sim, clusters, cl1, cl2):
    n_nodes = len(clusters)
    cl_array = np.array(clusters)
    allIdx = np.arange(n_nodes)
    idx1 = allIdx[clusters==cl1]
    idx2 = allIdx[clusters==cl2]
    mn11 = np.mean(sim[idx1[:, None], idx1])
    mn12 = np.mean(sim[idx1[:, None], idx2])
    mn21 = np.mean(sim[idx2[:, None], idx1])
    mn22 = np.mean(sim[idx2[:, None], idx2])
    sil12 = (mn11-mn12)/max(mn11,mn12)
    sil21 = (mn22-mn21)/max(mn22,mn21)

# compute cluster-level silhouette for all clusters from
# average similarity between nodes in a cluster
# and average similarity between nodes in different clusters
#
def cluster_sim_silhouette(sim, clusters):
    n_nodes = len(clusters)
    clus = set(clusters)
    n_clus = len(clus)
    clus_sil = np.zeros([n_clus, n_clus])
    cl_array = np.array(clusters)
    allIdx = np.arange(n_nodes)
    for i in range(n_clus):
        cl1 = clus[i]
        idx1 = allIdx[cl_array==cl1]
        clus_sil[i,i] = mn11 = np.mean(sim[idx1[:, None], idx1])
        for j in range(i,n_clus):
            if i != j:
                cl2 = clus[j]
                idx2 = allIdx[cl_array==cl2]
                mn12 = np.mean(sim[idx1[:, None], idx2])
                mn21 = np.mean(sim[idx2[:, None], idx1])
                clus_sil[j,j] = mn22 = np.mean(sim[idx2[:, None], idx2])
                clus_sil[i,j] = (mn11-mn12)/max(mn11,mn12)
                clus_sil[j,i] = (mn22-mn21)/max(mn22,mn21)
    return clus_sil

# compute cluster-level silhouette for all clusters from
# thresholded similarity matrix (weighted link matrix)
# computes average non-zero similarity between nodes in a cluster
# and average non-zero similarity between nodes in different clusters
#
def cluster_link_silhouette(links, clusters):
    n_nodes = len(clusters)
    clus = list(set(clusters))
    n_clus = len(clus)
    clus_sil = np.zeros([n_clus, n_clus])
    cl_array = np.array(clusters)
    allIdx = np.arange(n_nodes)
    for i in range(n_clus):
        cl1 = clus[i]
        idx1 = allIdx[cl_array==cl1]
        sim11 = links[idx1[:, None], idx1]
#        clus_sil[i,i] = mn11 = sim11.sum()/sim11.nnz
        clus_sil[i,i] = sim11.sum()/sim11.nnz
        mn11 = sim11.mean()
        for j in range(i,n_clus):
            if i != j:
                cl2 = clus[j]
                idx2 = allIdx[cl_array==cl2]
                sim12 = links[idx1[:, None], idx2]
                sim21 = links[idx2[:, None], idx1]
#                mn12 = sim12.sum()/sim12.nnz if sim12.nnz > 0 else 0
#                mn21 = sim21.sum()/sim21.nnz if sim21.nnz > 0 else 0
                mn12 = sim12.mean() if sim12.nnz > 0 else 0
                mn21 = sim21.mean() if sim21.nnz > 0 else 0
                sim22 = links[idx2[:, None], idx2]
                clus_sil[j,j] = sim22.sum()/sim22.nnz
                mn22 = sim22.mean()
                clus_sil[i,j] = (mn12-mn11)/max(mn11,mn12)
                clus_sil[j,i] = (mn21-mn22)/max(mn22,mn21)
    return clus_sil

def clusterSilhouetteProperty(network, clustering, wt='None'):
    links = nx.adjacency_matrix(network, weight=wt)
    clusters = list(set([n[clustering] for n in network]))
    sil = cluster_link_silhouette(links, clusters)
    return sil