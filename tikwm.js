const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');

function extractData(html) {
  try {
    const $ = cheerio.load(html);
    
    const poster = $('[poster]').attr('poster');
    const url = $('[data-src]').attr('data-src');
    return {
      poster, 
      url
    };
  } catch (error) {
    console.log("Extract error:", error);
  }
}


const getVideoInfo = async (url) => {
  try {
    const response = await axios.post('https://tikvid.io/api/ajaxSearch', querystring.stringify({
      q: url,
      lang: 'en'
    }), 
    {
      headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
    }
    });
    console.log(response.data.statusCode)
    return extractData(response.data.data);
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = { getVideoInfo };