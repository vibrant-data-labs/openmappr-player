from athena import entities 

dsjson = {u'dateModified': 1430303193650, u'name': u'dataset', u'datapoints': [{u'id': u'0', u'attr': {u'City': u'Washington', u'OrigID': u'1', u'Mailing Address': u'705 5th Street SE', u'State / Province / Region': u'DC', u'Sex': u'Male'}}, {u'id': u'1', u'attr': {u'City': u'Fuschl am See ', u'OrigID': u'2', u'Mailing Address': u'Red Bull Gmbh ', u'State / Province / Region': u'Salzburg', u'Sex': u'Male'}}, {u'id': u'2', u'attr': {u'City': u'Pasadena', u'OrigID': u'3', u'Mailing Address': u'1954 Brigden Road', u'State / Province / Region': u'CA', u'Sex': u'Male'}}], u'id': u'5540b1d9f7465aca52c56faf', u'projectId': u'5540b1d907ec0ee29232d123', u'sourceInfo': {u'sourceType': u'XLSX'}, u'attrDescriptors': [{u'attrType': u'base.xlsx', u'title': u'OrigID', u'generatorOptions': True, u'visible': True, u'generatorType': u'internal', u'id': u'OrigID'}, {u'attrType': u'base.xlsx', u'title': u'Sex', u'generatorOptions': True, u'visible': True, u'generatorType': u'internal', u'id': u'Sex'}, {u'attrType': u'base.xlsx', u'title': u'Mailing Address', u'generatorOptions': True, u'visible': True, u'generatorType': u'internal', u'id': u'Mailing Address'}, {u'attrType': u'base.xlsx', u'title': u'City', u'generatorOptions': True, u'visible': True, u'generatorType': u'internal', u'id': u'City'}, {u'attrType': u'base.xlsx', u'title': u'State / Province / Region', u'generatorOptions': True, u'visible': True, u'generatorType': u'internal', u'id': u'State / Province / Region'}], u'dateCreated': 1430303193650}
nwjson = {
    u'linkAttrDescriptors': [
        {u'attrType': u'color', u'title': u'OriginalColor', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalColor'},
        {u'attrType': u'float', u'title': u'OriginalSize', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalSize'},
        {u'attrType': u'string', u'title': u'OriginalLabel', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalLabel'}],
    u'name': u'default',
    u'links': [
        {u'source': u'2', u'attr': {u'topAnswers': u'1_15', u'similarity': u'1', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(178,12,241)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'9962vs', u'target': u'1'},
        {u'source': u'2', u'attr': {u'topAnswers': u'1_15', u'similarity': u'1', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(137,69,209)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'4y9abd', u'target': u'0'},
        {u'source': u'1', u'attr': {u'topAnswers': u'1_22', u'similarity': u'1', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(89,62,66)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'f1kshu', u'target': u'2'},
        {u'source': u'1', u'attr': {u'topAnswers': u'1_22', u'similarity': u'1', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(13,112,218)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'oiduf5', u'target': u'0'},
        {u'source': u'0', u'attr': {u'topAnswers': u'1_15', u'similarity': u'1', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(179,178,151)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'f023j5', u'target': u'1'},
        {u'source': u'0', u'attr': {u'topAnswers': u'', u'similarity': u'0.707106781', u'edgeType': u'UNKNOWN', u'OriginalLabel': u'link', u'OriginalColor': u'rgb(34,136,93)', u'OriginalSize': 20}, u'isDirectional': False, u'id': u'qkck0a', u'target': u'2'}], 
    u'networkInfo': {}, u'generatorInfo': {}, u'dateCreated': 1430303193654, u'datasetId': u'5540b1d9f7465aca52c56faf', u'dateModified': 1430303193654,
    u'nodes': [
        {u'dataPointId': u'0', u'id': u'0', u'attr': {u'OriginalLabel': u'Adam Russell', u'OriginalColor': u'rgb(200,200,200)', u'OriginalX': 97.64137927, u'OriginalSize': 15.5649245, u'OriginalY': 7.655436429}}, 
        {u'dataPointId': u'1', u'id': u'1', u'attr': {u'OriginalLabel': u'Adam Yearsley', u'OriginalColor': u'rgb(200,200,200)', u'OriginalX': 38.10474174, u'OriginalSize': 72.90218335, u'OriginalY': 57.39410026}},
        {u'dataPointId': u'2', u'id': u'2', u'attr': {u'OriginalLabel': u'Akhil Madhani', u'OriginalColor': u'rgb(200,200,200)', u'OriginalX': 95.94453168, u'OriginalSize': 30.08413115, u'OriginalY': 66.97093358}}], 
    u'id': u'5540b1d9f7465aca52c56fb0',
    u'projectId': u'5543b1d9f7465aca52c56fb0',
    u'nodeAttrDescriptors': [
        {u'attrType': u'float', u'title': u'OriginalX', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalX'}, 
        {u'attrType': u'float', u'title': u'OriginalY', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalY'}, 
        {u'attrType': u'color', u'title': u'OriginalColor', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalColor'}, 
        {u'attrType': u'float', u'title': u'OriginalSize', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalSize'}, 
        {u'attrType': u'string', u'title': u'OriginalLabel', u'generatorOptions': None, u'visible': False, u'generatorType': u'Original_layout', u'id': u'OriginalLabel'}]}

def test_json_parsing_ds():
    ds = entities.create_dataset_from_json(dsjson)
    for n in ds.networkx_graph.nodes(data=True):
        print n
    assert True
    return ds


def test_json_parsing_nw():
    nw = entities.create_network_from_json(nwjson)
    for n in nw.networkx_graph.nodes(data=True):
        print n
    for e in nw.networkx_graph.edges(data=True):
        print e
    assert True
    return nw

def test_empty_nx_graph():
    ds = entities.create_dataset_from_json(dsjson)
    nw = entities.create_network_new(ds)
    assert True

def test_js_gen():
    # ds = entities.create_dataset_from_json(dsjson)
    nw = entities.create_network_from_json(nwjson)
    print "_" * 40
    print(nw.to_json())
    assert False
