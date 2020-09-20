import { Chart } from 'chart.js';
import _ from 'lodash';
import categoryIdToName from './categoryIdToName';

let _chart = null;

const drawChart = (ctx, data, delta) => {

  if (_chart !== null) {
    _chart.clear();
    _chart.destroy();
  }

  const keys = _.sortBy(Object.keys(data));

  const categories = _.union(_.flatMap(data, a => Object.keys(a)));
  let datasets = _.orderBy(
    categories.map(c => ({
      label: categoryIdToName[c],
      backgroundColor: stringToColour(c),
      borderColor: stringToColour(c),
      data: keys.map((key) => data[key][c] ? (delta ? data[key][c].diff : data[key][c][0].value) : null),
      borderWidth: 1
    })), d => d.data[d.data.length - 1]);

  _chart = new Chart(ctx, {
    // The type of chart we want to create
    type: 'line',

    // The data for our dataset
    data: {
      labels: keys,
      datasets: datasets
    },

    // Configuration options go here
    options: {
      tooltips: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

var stringToColour = function(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var colour = '#';
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xFF;
    colour += ('00' + value.toString(16)).substr(-2);
  }
  return colour;
}

export { drawChart };