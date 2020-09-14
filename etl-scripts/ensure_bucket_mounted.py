###
# A script which makes sure the bucket is correctly mounted and available to spark
#

def check_if_mounted(bucket_to_check):
  mounts = dbutils.fs.mounts()
  is_mounted = False
  for m in mounts:
    paths = m.source.split("//")
    if len(paths) > 1 and bucket_to_check == paths[1]:
      print "found bucket: %s" % bucket_to_check
      print "in mountInfo: %s" % str(m)
      is_mounted = True
  return is_mounted

def ensure_bucket_is_mounted(bucket):
  if check_if_mounted(bucket) is False:
    print "mounting bucket : %s ..." % bucket
    dbutils.fs.mount("s3a://%s:%s@%s" % (ACCESS_KEY, SECRET_KEY, bucket), "/mnt/%s" % bucket)
    print "mounting bucket : %s ...done" % bucket
  else:
    print "bucket: %s is already mounted" % bucket
