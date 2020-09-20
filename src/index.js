var fetch = require('node-fetch');
var _ = require('lodash');

import categoryIdToName from './categoryIdToName';
import { drawChart } from  './graph';

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

const getData = async (code) => {
    const resp = await fetch('https://raw.githubusercontent.com/opencovid19-fr/data/master/dist/chiffres-cles.json');
    let raw_json = await resp.json();

    raw_json = _.filter(raw_json, a => a.code === code && a.source.nom !== 'OpenCOVID19-fr');

    // Get important info
    raw_json = _.map(raw_json, ({
        date,
        casConfirmes,
        hospitalises,
        deces,
        reanimation,
        gueris,
        decesEhpad,
        depistes,
        source: {
            nom
        }
    }) => ({
        date,
        casConfirmes,
        hospitalises,
        deces,
        decesEhpad,
        reanimation,
        gueris,
        depistes,
        sourceNom: nom
    }));

    // Order descending
    raw_json = _.orderBy(raw_json, a => a.date, 'desc');

    // Group by date
    raw_json = _.groupBy(raw_json, a => a.date)


    let formatedData = {};

    for (const date in raw_json) {
        const mergedData = {};

        raw_json[date].forEach(({
            date: __,
            ...data
        }) => {
            Object.keys(data).forEach(category => {

                // Is there already some data for that category ?
                const valueForcategory = parseInt(data[category]);

                if (isNaN(valueForcategory))
                  return;

                if (mergedData[category]) {

                    // Is there already a source with the same result ?
                    const existingIndex = _.findIndex(mergedData[category], a => a.value === valueForcategory);

                    // Yes, then add the new source to the sources array
                    if (existingIndex != -1) {
                        mergedData[category][existingIndex].sources.push(data.sourceNom);
                    }
                    // No, create a new content in the mergedData for that category
                    else {
                        mergedData[category].push({
                            sources: [data.sourceNom],
                            value: valueForcategory
                        });
                    }
                }
                // First data for that category
                else {
                    mergedData[category] = [{
                        sources: [data.sourceNom],
                        value: valueForcategory
                    }];
                }
            });
        });

        formatedData = {
            ...formatedData,
            [date]: mergedData
        };
    }

    return formatedData;
}

const getListHtml = (formatedData) => {
    const dateOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };

    const formatValues = (date, category) => '<div style="display: inline-block;">' + _.reduce(formatedData[date][category], (prev, content) => {
      const { sources, value } = content;
      var yesterday = new Date(date).addDays(-1).toISOString().substring(0, 10);
      const previousData = formatedData[yesterday] && formatedData[yesterday][category] ? {
          diff: value - formatedData[yesterday][category][0].value,
          diffPercent: (value - formatedData[yesterday][category][0].value) * 100 / value,
       } : null;
      return `${prev ? `${prev}<br />` : ''}<span style="font-weight: bold;margin-left: 5px;margin-right: 5px;">${value} ${previousData ? `(${previousData.diffPercent > 0 ? '+' : ''}${previousData.diff}, ${previousData.diffPercent > 0 ? '+' : ''}${previousData.diffPercent.toString().slice(0, 4)}%)` : ''}</span> (${sources.join(', ')})`;
    }, '') + '</div>';

    const formatCategories = (date) =>_ .reduce(Object.keys(formatedData[date]), (prev, category) => prev + `
    <span style="font-style: italic;margin-left: 20px;display: inline-block;width: 140px;vertical-align: top;">${categoryIdToName[category]} :</span> ${formatValues(date, category)}<br/>\n`, '')

    let html = _.reduce(Object.keys(formatedData), (prev, date) => prev + `\n
  <li class="list-group-item">
    <h3>${new Date(date).toLocaleString("fr", dateOptions)}</h3>\n
    ` + formatCategories(date) + `
  </li>`, '');

    html = `<ul class="list-group">${html}</ul>`;

    return html;
};

(async function() {
    const code = 'FRA';

    const formatedData = await getData(code);
    console.log(formatedData);

    document.querySelector('#root').innerHTML = getListHtml(formatedData);

    var ctx = document.getElementById('chart').getContext('2d');
    drawChart(ctx, formatedData);
})()
