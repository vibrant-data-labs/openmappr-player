
#########
# compute entity similarities
def cosineSim(m):
    # compute dot product
    print("[cosineSim] compute dot product")
    mdot = np.array(m.dot(m.T).todense())
    # compute inverse feature vector magnitudes
    print("[cosineSim] compute inverse feature lens")
    invSqMag = np.array(1.0/np.diag(mdot))
    # set NaN to zero
    invSqMag[np.isinf(invSqMag)] = 0
    invMag = np.sqrt(invSqMag)
    # get cosine sim by elementwise multiply by inverse magnitudes
    print("[cosineSim] scale dot product")
    #invMagMat = np.diag(invMag)
    #sim = np.dot(np.dot(invMagMat, mdot), invMagMat)
    sim = (mdot * invMag).T * invMag
    print("[cosineSim] done")
    return sim

def load_entity_user_wt(entityUserDF):
  _entities = [e[0] for e in entityUserDF.select(entity).distinct().collect()]
  _entityUserWt = {}
  _entity_chunks = [_entities[i:i+5] for i in range(0,len(_entities),5)]
  for ents in _entity_chunks:
    userlist = [(e[0], e[1], e[2]) for e in entityUserDF.where(entityUserDF[entity].isin(ents)).select(entity,userIdCol,weightCol).collect()]
    for e,u,wt in userlist:
      e_u_wt_list = _entityUserWt.get(e)
      if e_u_wt_list is None:
        _entityUserWt[e] = {u : wt}
      else:
        e_u_wt_list[u] = wt

  users = [u[0] for u in entityUserDF.select(userIdCol).distinct().collect()]
  # entities = list({u[0] for u in entityUserWt_list})
  entities = _entities
  return (entities, users, _entityUserWt)

def compute_sim_mat(entityUserDF):
  # build a dict of {userID: integer index}
  entities, users, entityUserWt = load_entity_user_wt(entityUserDF)

  nusers = len(users)
  print "nusers: %d" % nusers
  useridx = dict(izip(iter(users), iter(range(nusers))))
  nEntities = len(entities)
  print "nEntities: %d" % nEntities
  # build feature vector - each row is an entity, each column is a user
  print("[computeEntitySims] Building feature vectors %s" % str(datetime.datetime.now()))
  uservecs = []
  for idx in range(nEntities):
    eudf = entityUserWt[entities[idx]]
    # print("[computeEntitySims] Building feature vector %d for %s"%(idx, entities[idx]))
    uidx = [useridx[uid] for uid in eudf.keys()]
    rowdata = np.zeros(nusers)
    # weight each feature (user) by their number of (weighted) orders
    rowdata[uidx] = [eudf[uid] for uid in eudf.keys()]
    # rowdata[uidx] = 1      # unweighted
    uservecs.append(csr_matrix(rowdata))
  uservecs = vstack(uservecs)  
  print("[computeEntitySims] Computing cosine similarity %s"% str(datetime.datetime.now()))
  sim = cosineSim(uservecs)
  print("[computeEntitySims] Done computing cosine similarity %s"% str(datetime.datetime.now()))
  return sim

def write_simMat_s3(sim):
  print "sim length: %d" % len(sim)

  binary_dump = dumps(sim,-1)
  print "writing simMat to s3 Key: %s/%s" % (AWS_BUCKET_NAME, destSimMatKey)

  # Open a connection to S3 and write the contents
  conn = S3Connection(ACCESS_KEY, SECRET_KEY)
  bucket = conn.get_bucket(AWS_BUCKET_NAME)
  k = Key(bucket)
  k.key = destSimMatKey
  k.set_metadata("encoder","pickle-version-2")
  k.set_metadata("generated-by", "mappr-etl")
  k.set_metadata("generated-by-source", srcFilePath)
  k.set_contents_from_string(binary_dump)
  print "written simMat to S3."

simMatDF = orderUserInfoDF.groupby(entity, userIdCol).agg(F.first(weightCol).alias(weightCol)).cache() 
sim = compute_sim_mat(simMatDF)
write_simMat_s3(sim)
