# Common Ops Engine Specification
Commons Ops engine has been developed at lightning pace. I am writing this doc to track what has happened and plan the testing strategy for max coverage.
Side goal is to guide others into creating new algos and using it effectively.


## Ops Overview
There are 3 types of attributes + 2 modifier
### Algos
1. transform_ops - `attr -> attr` transforms. like log, round, thumbnails
2. reduce_ops - `[node attrs]` -> attrs. like concat, union, sum.
3. general_ops - arbitary data modfiers. Things like summaries, deduplicate and any class of ops can be here

##### Other Algo considerations
* summary_ops -> generates a report instead of operating on data

### Modifiers
###### groupBy
if enabled, then nodes are grouped depending open the given grouping attr(s) and then above algos are run independently on them. Additionally, ability to generate Summaries is enabled for the resultant groups.
For now, 3 algorithms _generate numeric/cat/tag summaries_, can be used to write the summaries on the nodes. 

###### Summary By(TODO)
Summaries of the groups created from groupBy. They are prefixed by `group_`, selectable in the srcAttId dropdowns

1. numeric - max, quantile_75, median, quantile_25, min, mean
2. tags/categories/strings - unique, maxFreqVal, minFreqVal

##### Other modifier considerations
* constraintBy -> run selected algo only on nodes which match given constraints

## Important Functions
#### shared_code.js

* `genDestAttrs (opInst, destAttrType, attrDescriptors)` - Creating attrs of updating their types is a common option. This function scans the OpInst and generates required attrs or/and update their attrTypes. Any `param.id` prefixed with `destAttrId` is also a candidate.

*`genParam()` - param spec builder

#### Builders
* `reduce_ops.js@genReduceFn(tFn, destAttrtype)` - helper to build opFn for reduce ops
* `transform_ops.js@genTransformFn(tFn, destAttrtype)` - helper to build opFn for transform ops


## Specifications

### Algo Specification
```js
{
    opType : "algo op class. valid values are: 'general_op','reduce_op' and 'transform_op'",
    id : "unique id of this op",
    name : "name. shown in the dropdown",
    desc : "description text",
    params : [/** List of params. see param descriptor doc*/ ],
    compactInput: false, // for transform ops, should the param be rendered in line or on the next line

    modifiesLinks : "boolean. whether it algo modifies links or not. If true, then the system ensures it gets the network data as well",
    removeAddDatapoints : "boolean, whether the algo removes or adds datapoints to the dataset. By default, algos can only update datapoints",

    groupModifierSupported : "boolean. whether it supports grouping. defaults to true",
    isGroupingEnabled : "enable grouping by default? defaults to false",
    groupAttrDesc : { /** group attr descriptor Object. See attr descriptor spec */ }

    isSummaryEnabled : "enable summary enabled by default? defaults to false. Summaries are only shown when groups are visible",
    summaryAttrDesc : { /** summary attr descriptor Object. See attr descriptor spec */ }
    
    sourceAttrDesc : { /** See attr descriptor spe */ },
    destAttrDesc : { /** See attr descriptor spe */ },
    
    opFn : function (opInst, nodes, nodeAttrs, links, linkAttrs) {
        /**
         * The transformation function which does all the hard work.
         * OpInst -> the an Instance of the op which contains all the things needed to run the code.
         *     See opInst spec
         */
        return {newNodes, modifiedNodeAttrs, newLinks, modifiedLinkAttrs};
    }
}
```
See op_library for spec examples

### Attr Descriptor Spec
```js
{
    /**
     * Contains a set of filter flags which are used to filter the attr listing.
     * Each filter flag has 3 states
     * true -> filter enabled, select attrs for which this flag is true
     * false -> filter enabled. select attrs for which this flag is false
     * null / not specified -> filter disabled
     */
    isNumeric : "select numeric attrs. like Integer / Floats / latitude / longitude / timestamps",
    isTag : "select liststring type attrs",
}
```

### Param Specification
```js
// param spec
// THe most complex descriptor
// shared_code.js@genParam is the builder.
{
    id : "id of param. if prefix is destAttrId is special and triggers attribute generation in genDestAttrs()"
    tooltip : "The tooltip / desc text of the param. for general / reduce ops, this is shown as description",
    defaultValue : "The default value",
    /**
     * types of params.
     * Simple -> simple params. Renders as text box.
     * Array -> A list of simple params.
     * Option -> a selectable list of options. 
     * Array[Option] -> a list of option types
     * attr-select -> select from node Attrs of data.
     */
    paramType : "Type of param, see above decription",
    options : [/** Only for Option Type, list of all possible options*/],
    // attr-select specific options
    isTag     : "same behaviour as attr descriptor",
    isNumeric : "same behaviour as attr descriptor"
}
```

## OpInst Specification
OpInst encapsulates all the data required for successful execution of algorithm

### Summary Data Spec
```js
{
	// opInst object
	isGroupingEnabled : true, // needs to be true for summaries to wrok
	isSummaryEnabled : true, // generate summaries or not
	summaryRows : [{
		summaryAttrId : "id of attr for which summary has to be generated",
		isNumeric : "is attr of numeric type?",
		isTag : "is attr of tag type?",
		/**
		 * Which summaries to generate.
		 * for numeric, ["min", "max", "mean", "median", "quantile_25", "quantile_75"]
		 * for cat / tag : ["unique", "maxFreq", "minFreq"]
		 */
		generations : []
	}]
}
```
