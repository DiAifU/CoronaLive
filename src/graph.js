import { Chart } from 'chart.js';
import _ from 'lodash';
import categoryIdToName from './categoryIdToName';

let _chart = null;

const nameToCategoryId = _.invert(categoryIdToName);

const buildChart = (ctx, onHiddenChanged) => {
  _chart = new Chart(ctx, {
    // The type of chart we want to create
    type: 'line',

    // Configuration options go here
    options: {
      tooltips: {
        intersect: false,
        mode: 'index'
      },
      legend: {
        onClick: (e, legendItem) => {
          if (onHiddenChanged) {
            var dataset = _chart.data.datasets[legendItem.datasetIndex];
            onHiddenChanged(nameToCategoryId[dataset.label], dataset.hidden === false)
          }
        }
      }
    }
  });
}

const updateChart = (data, delta, hiddenCategories = []) => {
  if (_chart === null) {
    throw "Chart was not previously built";
  }

  const keys = _.sortBy(Object.keys(data));
  const categories = _.union(_.flatMap(data, a => Object.keys(a)));

  const datasets = _.orderBy(
    categories.map(c => ({
      label: categoryIdToName[c],
      backgroundColor: stringToColour(c),
      borderColor: stringToColour(c),
      data: keys.map((key) => data[key][c] ? (delta ? data[key][c].diff : data[key][c][0].value) : null),
      borderWidth: 1,
      hidden: hiddenCategories.includes(c)
    })), d => d.data[d.data.length - 1]);

    _chart.data = {
      labels: keys,
      datasets
    };

    _chart.update();
}

const stringToColour = (str) => {
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

export { buildChart, updateChart };