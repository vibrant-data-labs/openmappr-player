# Databricks notebook source exported at Sat, 7 May 2016 19:12:30 UTC
# MAGIC %md
# MAGIC # Weighted entity extractions.
# MAGIC extract entities from sanitized parquet files.
# MAGIC #NOTES

# COMMAND ----------

import datetime
import math
from itertools import izip
import numpy as np
from pyspark import SparkContext
from pyspark.sql import SQLContext
from pyspark.sql.window import Window
from pyspark.sql.types import *
from pyspark import StorageLevel
import pyspark.sql.functions as F

from scipy.sparse import vstack
from scipy.sparse import csr_matrix, dok_matrix
from pickle import dumps
from boto.s3.connection import S3Connection
from boto.s3.connection import Key
from json import loads

# COMMAND ----------

# COMMAND ----------
# injected by Init script
# dataName = "slice30mb"
# srcFilePath = "/mnt/mappr-datasets/rtp/rtp-50mb-paraquet"
# destEntityInfoPath = '/mnt/mappr-temp/etl-results/%s/entityInfo.csv' % dataName
# destSimMatKey = '/etl-results/%s/simMat.pickle2' % dataName
# demographics = True
# filterSpecJson = ''
# access keys for s3 work
# ACCESS_KEY = ""
# SECRET_KEY = ""
# AWS_BUCKET_NAME = "mappr-temp"
# end args

print 'dataName: %s' % dataName
print 'srcFilePath: %s' % srcFilePath
print 'destEntityInfoPath: %s' % destEntityInfoPath
print 'destSimMatKey: %s' % destSimMatKey
print 'demographics: %s' % demographics
print 'filterSpecJson: %s' % filterSpecJson
print "AWS_BUCKET_NAME: %s" % AWS_BUCKET_NAME
print "ETL_BUCKET: %s" % ETL_BUCKET
print "colValFiltersEnabled: %s" % colValFiltersEnabled
print "colValFilters: %s" % colValFilters
print "partName: %s" % partName
print "entity: %s" % entity

#--- entity is either brand or merchant
nonEntity = 'brand' if entity == 'merchant' else 'merchant'
print "nonEntity: %s" % nonEntity
data_table = 'slice_data'
trans_table = 'slice_data_trans'
user_table = 'slice_data_user'
sqlContext.clearCache()


# COMMAND ----------

filterSpec_uberLyft = {
  "rowFilter" : "merchant IN ('Lyft','Uber') AND state IN ('LA', 'SF') "
}
filterSpec_apparelUsers = {
  'filterByColValues' : {
    'userID' : "category LIKE '%Apparel%'"
  }
}

# COMMAND ----------

weightCol = 'projWt'
transactionCols = ["merchant", "userID", "orderDate", "orderID", "itemID", "quantity", "spend", "brand", "category", "state", "zipCode"]
# what to filter
try:
  filter_spec = loads(filterSpecJson)
except Exception as e:
  print "exception in loading filter_spec",e
  filter_spec = None

# a summary of ops to perform
summaryOps = {}
summaryOps['sum'] = ['spend']
summaryOps['countDistinct'] = ['userID', "orderID", 'category', nonEntity]
# topCategory / subCategory are auto generated
summaryOps['col_as_tags'] = [nonEntity, 'category']
summaryOps['logs'] = [nonEntity, 'category', 'userID', 'spend', 'orderID', 'projWt']

# enable demographics
demographics = True
userIdCol = 'userID'
userCols = ["userID", "gender", "birthYrMo", "ethnicity", "education", "hhIncome", "NumAdults", "NumPPL", "Marital"]
demoSummaryOps = {}
demoSummaryOps['categorical'] = ['gender', 'ethnicity', 'education', 'hhIncome', 'Marital']
demoSummaryOps['numerical'] = ["NumAdults", "NumPPL"]
assert userIdCol in userCols

# how to treat empty / null values
fillNaOpts = {
  'spend' : 0.0,
  'projWt' : 1.0,

}

#common cols
orderID = 'orderID'
spend = 'spend'
orderDate = 'orderDate'

# control variables
maxTags = 100 # max number of tags to per entity

# COMMAND ----------

DEBUG_MODE = False
SKIP_SECTION_OUTPUT = True

# COMMAND ----------

# MAGIC %md
# MAGIC # Filter:
# MAGIC Filter out transaction given some conditions. Two types:
# MAGIC 1. row filters
# MAGIC eg:
# MAGIC if ?gender == M?
# MAGIC AND if ?state == CA?
# MAGIC 2. data summary filters. eg: all transactions for users who bought something in apparel category.
# MAGIC
# MAGIC ?category summary? includes ?Apparel?
# MAGIC
# MAGIC Examples:
# MAGIC - A set of 8,000 people
# MAGIC - four groups: Lyft in LA & SF; Uber in LA & SF
# MAGIC - the people who bought anything in Apparel, together with all their other transactions.

# COMMAND ----------

def filter_transactions(df, filterSpec):
  # there are 2 filters, row_filters and summary filters.
  # row filters. A string containing the filter infos
  # (F.col('merchant').inSet(['Lyft', 'Uber'])) & (F.col('state').inSet(['LA','SF']))
  row_filter = filterSpec.get("rowFilter", None)
  if row_filter:
    print "filtering rows with:", row_filter
    df = df.filter(str(row_filter))
  else:
    print "skipping filtering"

  filtered_df = df.cache()

  # column values filters.
  # for each attr, the given rowFilter is applied to transaction data. then, all distinct attr
  # values from the filtered data are selected as filteredList.
  # Only transactions which have attr value in this filterList are selected to form the final dataset.

  # filterByColValues is a dict of {ColName : filterSpec}
  # filterSpec is a dict containing options for filtering. for now, it contains "rowFilter" key.
  filterBy_attrs = filterSpec.get("filterByColValues", None)

  if filterBy_attrs is not None:
    for attr, filter_spec in filterBy_attrs.iteritems():
      print "for attr: %s, applying filter: %s " % (attr, filter_spec)
      filterList = F.broadcast(filtered_df.filter(str(filter_spec)).select(attr).distinct())
      # filter data via join
      filtered_df = filtered_df.join(filterList, attr)
  return filtered_df

def filter_by_file(df, colValFilters):
  filteredDF = df
  for attr, filter_file in colValFilters.iteritems():
    print "loading file %s for attr: %s to selected values" %(filter_file, attr)
    fdf = sqlContext.read.format('com.databricks.spark.csv') \
                    .options(header=True, delimiter='\t') \
                    .load(filter_file).cache()
    selCol = fdf.columns[0]
    fdf = fdf.select(fdf[selCol].alias(attr))
    filteredDF = filteredDF.join(fdf, attr)
  return filteredDF

# COMMAND ----------

def gen_freq_distr_user_data(userDF, attrs):
  userWt = weightCol
  # get weighted frequencies of each category of a user's categorical attributes
  print("[getCategoryFreqs] Grouping records by users")
  categoryFreqInfo = {}
  udf = userDF
  for attr in attrs:
    print("Processing attribute %s" % attr)
    # get wt for each individual user
    _tbl = udf.filter(udf[attr].isNotNull()) \
              .groupby(userIdCol, attr) \
              .agg(F.first(userWt).alias(userWt))
    # sum up weight for each values of the attribute
    _tbl = _tbl.groupby(attr).agg(F.sum(userWt).alias('wt'))
    attrInfo = _tbl.collect()
    # build a dic of {attrValue:freq}
    vals = {x[attr]:x['wt'] for x in attrInfo}
    # sum of all occurances of attribute
    tot = sum(vals.values())
    #compute relative freq w.r.t to total occurances of the attribute
    info = {val: float(wt)/tot for val,wt in vals.iteritems()}
    categoryFreqInfo[attr] = info
  return categoryFreqInfo

# COMMAND ----------

def get_sub_category(cat):
  if cat is None:
    return None
  else:
    return ">".join([x.strip() for x in cat.split('>')][:2])

def removeOther(strArray):
  if len(strArray) > 1:
    return [s for s in strArray if not s.startswith("Other")]
  else:
    return strArray

removeOtherUDF = F.udf(removeOther, ArrayType(StringType()))
# window used rank each element in the group in desc order of "count", so that we can select top 100 or so
aWindow = Window.partitionBy(entity).orderBy(F.desc("count"))

# builder for a tag table for each entity,attr
def build_tag_tbl(attrDF, attr, pluralAttr, limitRows=100):
  # find out top rows for each entity. We do this by generating rank
  tbl = attrDF.groupBy(entity, attr).count() \
          .select(entity, attr, "count", F.row_number().over(aWindow).alias("rank")) \
          .where(F.col("rank") < limitRows) \
          .groupby(entity).agg(F.collect_list(attr).alias(pluralAttr)) # collect attrs into a single ArrayColumn

  #apply "removeOtherUDF()" to remove "other" if necessary, then concat with '|'
  tbl = tbl.select(entity, F.concat_ws("|", removeOtherUDF(tbl[pluralAttr])).alias(pluralAttr))
  return tbl

def gen_tag_info_tbl(df, col_list):
  category = 'category'
  topCat = 'topCategory'
  subCat = 'subCategory'
  selectExpr = [F.col(x) for x in col_list]
  attrDF = df
  print "generation tags for :", col_list
  # if category is in this list, then generate topCat and subCat tags as well
  if category in col_list:
    subCatUDF = F.udf(get_sub_category, StringType())
    attrDF = df.select(entity,
                       F.trim(F.split(F.col(category),">")[0]).alias(topCat),
                       *selectExpr) \
               .withColumn(subCat, subCatUDF(df.category))
    col_list= col_list + [subCat,topCat]
  else:
    attrDF = df.select(entity, *selectExpr)

  attrDF.persist(StorageLevel.MEMORY_AND_DISK_SER)
  print "attrDF schema"
  attrDF.printSchema()
  tagTbls = [build_tag_tbl(attrDF, x, x + '_tags', maxTags) for x in col_list]

  #the final tag tbl
  tagTbl = reduce(lambda attrDF, tbl: attrDF.join(tbl, entity, how="outer"), tagTbls)
  return tagTbl

# COMMAND ----------

def analyse_numeric_attr(entityUserDF, attr):
  data = entityUserDF
  userWt = weightCol
  # compute weighted value of attr
  tbl = data.select(entity, attr, userWt) \
    .filter(data[attr].isNotNull()) \
    .withColumn("wtd", data[attr] * data[userWt])
  # compute mean
  tbl = tbl.groupby(entity).agg(F.sum("wtd"), F.sum(userWt).alias(userWt))
  return tbl.select(entity, (F.col("sum(wtd)") / F.col(userWt)).alias("mean_" + attr))

def build_numeric_tbl(entityUserDF, numCols):
  numericTbls = [analyse_numeric_attr(entityUserDF,x) for x in numCols]
  #the final numeric tbl
  numericTbl = reduce(lambda df, tbl: df.join(tbl, entity, how="outer"), numericTbls)
  return numericTbl

# COMMAND ----------

# MAGIC %md
# MAGIC #Categorical Data Algo
# MAGIC There are 5 categories, `[gender, ethnicity, education, hhIncome, Marital]`, for each we want to find common outliers compared to global frequency. (>2SD away from the frequency found in the whole dataset)
# MAGIC
# MAGIC Algo
# MAGIC For each entity
# MAGIC - group by attribute, summing up projWt and number of rows
# MAGIC - sum up wt for the attribute as totalWt
# MAGIC - for each val, wt for attribute:
# MAGIC   - p := global wt
# MAGIC   - mn := p * totalWt

# COMMAND ----------

# add category values that are common (not all outliers) compared to the global frequency
# category frequency weighted by projected weight
def addCategoryData(entityUserDF, attr, catFreqInfo):
  print "loading category info data for attr: %s" % attr
  #global freq table
  _freqTbl = F.broadcast(sqlContext.createDataFrame([(k,v) for k,v in catFreqInfo[attr].iteritems()], [attr, "p"]))

  # a table containing (entity, attr, sum(projWt))
  attrInfoTbl = entityUserDF.filter(F.length(F.col(attr)) > 0) \
                  .groupby(entity, attr) \
                  .agg(F.sum(weightCol).alias('wt')) \
                  .cache()

  # sum of projWt for each entity
  totalsTbl = attrInfoTbl.groupby(entity).agg(F.sum('wt').alias('totWt'))
  totalsTbl = F.broadcast(totalsTbl)

  attrInfoTbl = attrInfoTbl.join(totalsTbl, entity)
  #calcuate mn and sd
  attrInfoTbl = attrInfoTbl.join(_freqTbl, attr) \
                  .select(entity, attr, 'wt',
                          (totalsTbl['totWt'] * _freqTbl["p"]).alias("mn"),
                          F.sqrt(((totalsTbl['totWt'] * _freqTbl["p"]) *(1 - _freqTbl["p"]))).alias("sd"))#sd  sqrt(mn * (1 - p))

  # filter common outliers
  attrInfoTbl = attrInfoTbl.select(entity, attr, (((F.col("wt") - F.col("mn"))/F.col("sd")) > 2.0).alias('shouldInclude'))
  attrInfoTbl = attrInfoTbl.filter(attrInfoTbl['shouldInclude']).drop(F.col("shouldInclude"))

  #collect categories and concat them
  attrInfoTbl = attrInfoTbl.groupby(entity) \
                  .agg(F.collect_list(F.col(attr)).alias(attr)) \
                  .select(entity, F.concat_ws("|", F.col(attr)).alias("common_" + attr))

  return attrInfoTbl

def build_category_data(entityUserDF, categoricalAttrs, catFreqInfo):
  attrTbls = [addCategoryData(entityUserDF, attr, catFreqInfo) for attr in categoricalAttrs]
  attrTbls = reduce(lambda df, tbl: df.join(tbl, entity, how="outer"), attrTbls)
  return attrTbls

# COMMAND ----------

def build_age_tbl(entityUserDF, birthYrMo):
  userWt = weightCol
  # compute mean age from birth year/month field, avoiding missing data
  ageTbl = entityUserDF.select(entity, birthYrMo, userWt) \
    .filter(F.col(birthYrMo).isNotNull()) \
    .withColumn("wtdAge", (2016 - F.col(birthYrMo) / 100) * F.col(userWt))

  # compute mean age for each entity
  entityAgeTbl = ageTbl.groupBy(entity) \
                  .agg(F.sum("wtdAge"), F.sum(userWt).alias('sum(userWt)')) \
                  .select(entity, (F.col("sum(wtdAge)") / F.col("sum(userWt)")).alias("mean_age"))
  return entityAgeTbl

# COMMAND ----------

# Original AlGo
# select those (entity, order pairs) where number of records > 100
# sort by date, ascending
# add a column "date"
# od = list of all dates. We are interested only in od[0] and od [-1]
# add Column "dateFrac" which is the slope of date. i.e (date - od[0]) / (od[-1] - od[0])
# start = all dateFrac < 0.25
# end = all dateFrac > 0.75
# initSpend = head of agg on start
# finalSpend = head of agg on end
# finally compute FracGrowthRate
# display(fracGrowthRateTbl)
def dateVal(x):
  return float(x[:4]) + float(x[5:7])/12 + float(x[8:10])/365 if x is not None and len(x) == 10 else -1.0

def build_frac_growth_rate_tbl(orderInfoDF):
  projWt = weightCol
  #udf to process orderDate into *something*
  dateValUDF = F.udf(dateVal, FloatType())

  df = orderInfoDF.select(entity, orderID, spend, projWt, orderDate).sort(orderDate)
  df = df.withColumn("date", dateValUDF(orderDate)).drop(orderDate).cache()

  # find min,max for each entity
  od = df.groupby(entity).agg(F.min("date"), F.max("date"))
  od = F.broadcast(od.filter(od["max(date)"] > od["min(date)"]))

  # compute dateFrac which is the slope of date. i.e (date - od[0]) / (od[-1] - od[0])
  df = df.join(od, entity).withColumn("dateFrac", (df["date"] - od["min(date)"]) / (od["max(date)"] - od["min(date)"]))

  start = df[df["dateFrac"] < 0.25]
  end = df[df["dateFrac"] > 0.75]

  initSpend = start.groupby(entity).agg(F.sum(start[spend] * start[projWt]).alias("initSpend")) \
                .filter(F.col("initSpend").isNotNull() & (F.col("initSpend") > 0))
  finalSpend = end.groupby(entity).agg(F.sum(end[spend] * end[projWt]).alias("finalSpend")) \
                .filter(F.col("finalSpend").isNotNull())
  # calc fracGrowth Rate (finalSpend - initSpend)/initSpend if initSpend != None and finalSpend != None and initSpend > 0 else 0
  tbl = initSpend.join(finalSpend, entity)
  return tbl.select(entity, ((F.col("finalSpend") - F.col("initSpend")) / F.col("initSpend")).alias("growthRate"))

# COMMAND ----------

def build_order_tbl(df):
  userAggExpr = [F.first(x).alias(x) for x in userCols if x not in [userIdCol, entity]]
  aggExpr = userAggExpr + [F.first(weightCol).alias(weightCol),
                           F.first('orderDate').alias('orderDate'),
                           F.sum(spend).alias(spend)]
  # calc ordering patterns of user, alongwith user info
  orderInfoDF = df.groupBy(entity, userIdCol, orderID).agg(*aggExpr)

  orderInfoDF.registerTempTable(trans_table)
  # orderInfoDF.cache()
  return orderInfoDF

def build_entity_user_tbl(orderInfoDF):
  aggExpr = [F.first(x).alias(x) for x in userCols if x not in [userIdCol, entity]]
  aggExpr.append(F.first(weightCol).alias(weightCol))
  aggExpr.append(F.sum(weightCol).alias('orderWt'))
  entityUserDF = orderInfoDF.groupBy(entity, userIdCol).agg(*aggExpr)
  entityUserDF.registerTempTable(user_table)
  # entityUserDF.cache()
  return entityUserDF


# COMMAND ----------

def analyse_transactions(df):
  ops = ['countDistinct', 'sum']
  opsF = {
    'countDistinct' : F.countDistinct,
    'sum' : F.sum
  }
  aggrOps = [opsF[op](x).alias(x + '_' + op) for op in ops for x in summaryOps[op]]
  entitySumDF = df.groupby(entity).agg(*aggrOps)
  # build tags
  tagTbl = gen_tag_info_tbl(df, summaryOps['col_as_tags'])
  entitySumDF = entitySumDF.join(tagTbl, entity, how='left_outer')
  return entitySumDF

# COMMAND ----------

def generate_demographic_info(entityUserDF, userCols):
  #for categorical
  #calc global freq
  catCols = demoSummaryOps['categorical']
  globalFreqData = gen_freq_distr_user_data(entityUserDF, catCols)
  catDataDF = build_category_data(entityUserDF, catCols, globalFreqData)
  #numerical cols
  numCols = demoSummaryOps['numerical']
  numDataDF = build_numeric_tbl(entityUserDF, numCols)
  #spl case of age
  ageTbl = build_age_tbl(entityUserDF, 'birthYrMo')
  return catDataDF.join(numDataDF, entity, how="outer").join(ageTbl, entity, how="left_outer")

# COMMAND ----------

def load_data(fileurl, tableName):
  df = sqlContext.read.parquet(fileurl).na.fill(fillNaOpts) #full data loader
  df.registerTempTable(tableName)
  return df

def run_entity_extraction(srcFilePath, partName):
  sqlContext.clearCache()
  df = load_data(srcFilePath, data_table + "_" + partName)
  df.printSchema()
  # filter out invalid data
  # df = df.filter(df[entity].isNotNull())

  orderUserInfoDF = build_order_tbl(df)
  entityUserDF = build_entity_user_tbl(orderUserInfoDF)

  entityInfoDF = analyse_transactions(df)

  # add proj Wt
  weightColPerOrder = orderUserInfoDF.groupby(entity).agg(F.sum(weightCol).alias(weightCol))
  entityInfoDF = entityInfoDF.join(weightColPerOrder, entity)
  #add growthRate
  entityInfoDF = entityInfoDF.join(build_frac_growth_rate_tbl(orderUserInfoDF), entity, how="left_outer")

  print 'generating demographics'
  demographicTbl = generate_demographic_info(entityUserDF, userCols)
  entityInfoDF = entityInfoDF.join(demographicTbl, entity, how='left_outer')

  # finally add bunch of log values for selected cols
  cols_for_log = [x for x,y in entityInfoDF.dtypes if any(map(x.startswith, summaryOps['logs'])) if y in ['double', 'float', 'int', 'long', 'bigint']]
  print "gen log for cols", cols_for_log
  for col in cols_for_log:
    entityInfoDF = entityInfoDF.withColumn("log_" + col, F.when(entityInfoDF[col] > 0, F.log10(col)).otherwise(0))

  # entityInfoDF = entityInfoDF.cache()
  entityInfoDF.repartition(1).write.mode("overwrite").format('com.databricks.spark.csv') \
      .options(header='true', mode="overwrite") \
      .save('/mnt/' + AWS_BUCKET_NAME + '/' + destEntityInfoPath)
  orderUserInfoDF.unpersist()
  entities = entityInfoDF.select(entity).map(lambda r: r[entity]).collect()
  return (entities, entityUserDF)

### finally run entity extraction
entities, entityUserDF = run_entity_extraction(srcFilePath, partName)
