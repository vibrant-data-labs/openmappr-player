angular.module('common')
.filter('neighborsFilter', function() {
    return function(neighbors) {
      var filterNeighbors = [];
      
      for (var i = 0; i < neighbors.length; i++) {
        if (i == 5) break;
        filterNeighbors.push({
          id: neighbors[i].linkNode.id,
          dataPointId: neighbors[i].linkNode.dataPointId,
          attr: neighbors[i].linkNode.attr,
          name : getName(neighbors[i].linkNode.attr),
          linkNodeLabel: neighbors[i].linkNodeLabel,
          linkNodeImage: neighbors[i].linkNodeImage
        });
      }

      console.log(`neighborsFilter `,filterNeighbors);
      return filterNeighbors;
    };

    function getName(attrs){
      var name = '';
      var attrsArray = Object.keys(attrs);
      var attrsName = attrsArray.map( (attr) => attr.toLowerCase().includes('name') ? attr : null);
      attrsName.filter(Boolean).forEach((attrName) => name+= `${attrs[attrName]} `);
      return name;
    }

  });