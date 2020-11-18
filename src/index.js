var fetch = require('node-fetch');
var _ = require('lodash');

import categoryIdToName from './categoryIdToName';
import { buildChart, updateChart } from  './graph';

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

    // Hotfix for https://github.com/DiAifU/CoronaLive/issues/1
    raw_json = _.forEach(raw_json, a => a.date = a.date.replace("_", "-"));

    // Order descending
    raw_json = _.orderBy(raw_json, a => a.date, 'desc');

    // Group by date
    raw_json = _.groupBy(raw_json, a => a.date)


    let formatedData = {};

    for (let date in raw_json) {
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

    Object.keys(formatedData).forEach(date => {
        var yesterday = new Date(date).addDays(-1).toISOString().substring(0, 10);
        Object.keys(formatedData[date]).forEach(category => {
            if (formatedData[yesterday] && formatedData[yesterday][category]) {
                formatedData[date][category].diff = formatedData[date][category][0].value - formatedData[yesterday][category][0].value
            }
        });
    });

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

const updateUrl = (queryString) => {
    const url = window.location.href.split('?')[0];
    if (queryString) {
        history.pushState({}, null, `${url}?${queryString}`);
    }
    else {
        history.pushState({}, null, url)
    }
}

(async function() {
    var urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || 'FRA';
    let delta = urlParams.get('type') === 'delta';
    let hiddenCurves = urlParams.has('hidden') ? urlParams.get('hidden').split(',') : [];

    const formatedData = await getData(code);
    console.log(formatedData);

    // Set root inner HTML from built data 
    const root = document.querySelector('#root');
    root.innerHTML = root.innerHTML + getListHtml(formatedData);    

    // Set delta checkbox state based on query param value (or default)
    const deltaCheckbox = document.querySelector('#deltaCheckBox');
    deltaCheckbox.checked = delta;
    
    // Create callback to be triggered when hidden categories changes
    const onHiddenChanged = (type, hidden) => {
        if (hidden) {
            if (!hiddenCurves.includes(type)) {
                hiddenCurves = [...hiddenCurves, type];
            }
        }
        else {
            if (hiddenCurves.includes(type)) {
                hiddenCurves = hiddenCurves.filter(item => item !== type)
            }
        }
        
        if (hiddenCurves.length > 0) {
            urlParams.set('hidden', hiddenCurves.join(','));
        }
        else {
            urlParams.delete('hidden');
        }

        updateUrl(urlParams.toString().replace(/%2C/g,","));

        updateChart(formatedData, delta, hiddenCurves);
    }

    // Get the context and build the chart
    const ctx = document.getElementById('chart').getContext('2d');
    buildChart(ctx, onHiddenChanged);

    // Listen to delta checbox checked state changes
    deltaCheckbox.addEventListener('change', e => {
        if (e.target.checked) {
            urlParams.set('type', 'delta');
            delta = true;
        }
        else {
            urlParams.delete('type');
            delta = false;
        }

        updateUrl(urlParams.toString().replace(/%2C/g,","));

        updateChart(formatedData, delta, hiddenCurves);
    });

    // Make initial update to set chart data
    updateChart(formatedData, delta, hiddenCurves);
})()
