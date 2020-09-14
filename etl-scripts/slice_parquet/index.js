//
// a defn of slice etl script spec

module.exports = {
	'suggestedColNames': ['merchant',
		'userID',
		'orderDate',
		'orderID',
		'itemID',
		'quantity',
		'spend',
		'projWt',
		'brand',
		'category',
		'state',
		'zipCode',
		'gender',
		'birthYrMo',
		'ethnicity',
		'education',
		'hhIncome',
		'NumAdults',
		'NumPPL',
		'Marital'
	],
	'weightInfo': {
		'weightEnabled' : true,
		'weightCol' : 'projWt'
	},
	'filterSpec': {
		'rowFilter' : "",
		'filterByColValues' : {
			'userID' : {
				'rowFilter' : ""
			}
		}
	},
	'etl_scripts' : [
		['extract entities', './etl-scripts/slice_parquet/extract_entities.py'],
		['build similarity matrix', './etl-scripts/slice_parquet/gen_sim_mat.py']],
	// for now, netgen is hardcoded
	'netgen' : {}
};
