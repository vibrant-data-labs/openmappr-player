
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

def load_entity_user_wt(entities, simMatDF):
  userList = simMatDF.select(userIdCol).distinct().map(lambda r: r[userIdCol]).collect()
  # assign zero based indices to entities and users
  edf = sqlContext.createDataFrame([m for m in enumerate(entities)], ['entIdx', entity])
  udf = sqlContext.createDataFrame([m for m in enumerate(userList)], ['userIdx', userIdCol])

  simdf = simMatDF.join(edf,entity).drop(entity).join(udf, userIdCol).drop(userIdCol)
  pdf = simdf.map(lambda r: (r.entIdx, r.userIdx, r.orderWt)).collect()

  _entityUserWt = {}
  S = dok_matrix((len(entities), len(userList)), dtype=np.float32)
  for e,u,wt in pdf:
    S[e,u] = wt
    # e_u_wt_list = _entityUserWt.get(e)
    # if e_u_wt_list is None:
    #   _entityUserWt[e] = {u : wt}
    # else:
    #   e_u_wt_list[u] = wt
  return S.tocsr()
  # return (userList, _entityUserWt)

def compute_sim_mat(entities, simMatDF):
  # build a dict of {userID: integer index}
  # users, entityUserWt = load_entity_user_wt(entities, simMatDF)

  # nusers = len(users)
  # print "nusers: %d" % nusers
  # nEntities = len(entities)
  # print "nEntities: %d" % nEntities
  # # build feature vector - each row is an entity, each column is a user
  # print("[computeEntitySims] Building feature vectors %s" % str(datetime.datetime.now()))
  # uservecs = []
  # for idx in range(nEntities):
  #   eudf = entityUserWt[idx]
  #   # print("[computeEntitySims] Building feature vector %d for %s"%(idx, entities[idx]))
  #   uidx = eudf.keys()
  #   rowdata = np.zeros(nusers)
  #   # weight each feature (user) by their number of (weighted) orders
  #   rowdata[uidx] = [eudf[uid] for uid in eudf.keys()]
  #   # rowdata[uidx] = 1      # unweighted
  #   uservecs.append(csr_matrix(rowdata))

  # uservecs = vstack(uservecs)  
  uservecs = load_entity_user_wt(entities, simMatDF)
  print("[computeEntitySims] Computing cosine similarity %s"% str(datetime.datetime.now()))
  sim = cosineSim(uservecs)
  print("[computeEntitySims] Done computing cosine similarity %s"% str(datetime.datetime.now()))
  return sim

def write_simMat_s3(sim, destSimMatKey):
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

_tmp_path = '/mnt/mappr-temp/intermediates/sim-mat-tmps/%s/%s' % (dataName, partName)
print "_tmp_path", _tmp_path
entityUserDF.select(entity, userIdCol, 'orderWt').coalesce(8).write.mode("overwrite").parquet(_tmp_path)
sqlContext.clearCache()
try:
  simMatDF = sqlContext.read.parquet(_tmp_path).cache()
  simMat = compute_sim_mat(entities, simMatDF)
  write_simMat_s3(simMat, destSimMatKey)
except Exception, e:
  raise e
finally:
  dbutils.fs.rm(_tmp_path, True)
