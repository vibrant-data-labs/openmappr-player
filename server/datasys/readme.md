# Data System Design
There are 2 primary collections
* DatasetRecord -> top level descriptor of dataset. who it belongs to and general info about it
* Network Record -> top level descriptor of network data. who to belongs to and general info.

Each record contains a pointer to data file which is stored in gridfs. data file can be for datapoints / nodes / links

Reference hierarchy
org -> proj -> DatasetRecord -> datapoints
org -> proj -> NetworkRecords -> nodes / links
org -> proj -> DatasetRecord -> Attrs

if node / link data changes, only dataset record has to be modified.

Attr Updates -> directly modify attr info


## Dataset
Dataset consists of datapoints and attrDescriptors. It has 3 parts
* DatasetRecord -> general description of this dataset, who it belongs to and so on
* DataPointRecord -> gridFS file containing all the datapoints
* 