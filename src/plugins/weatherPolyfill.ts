const weatherPolyfill = `
const TemperatureUnit = {
  Celsius: 'celsius',
  Fahrenheit: 'fahrenheit',
};

const WeatherCondition = {
  SunnyDay: 1,
  MostlySunnyDay: 2,
  PartlySunnyDay: 3,
  IntermittentCloudsDay: 4,
  HazySunshineDay: 5,
  MostlyCloudyDay: 6,
  Cloudy: 7,
  Overcast: 8,
  Fog: 11,
  Showers: 12,
  MostlyCloudyWithShowersDay: 13,
  PartlySunnyWithShowersDay: 14,
  Thunderstorms: 15,
  MostlyCloudyWithThunderstormsDay: 16,
  PartlySunnyWithThunderstormsDay: 17,
  Rain: 18,
  Flurries: 19,
  MostlyCloudyWithFlurriesDay: 20,
  PartlySunnyWithFlurriesDay: 21,
  Snow: 22,
  MostlyCloudyWithSnowDay: 23,
  Ice: 24,
  Sleet: 25,
  FreezingRain: 26,
  RainAndSnow: 29,
  Hot: 30,
  Cold: 31,
  Windy: 32,
  ClearNight: 33,
  MostlyClearNight: 34,
  PartlyCloudyNight: 35,
  IntermittentCloudsNight: 36,
  HazyMoonlight: 37,
  MostlyCloudyNight: 38,
  PartlyCloudyWithShowersNight: 39,
  MostlyCloudyWithShowersNight: 40,
  PartlyCloudyWithThunderstormsNight: 41,
  MostlyCloudyWithThunderstormsNight: 42,
  MostlyCloudyWithFlurriesNight: 43,
  MostlyCloudyWithSnowNight: 44,
};

const weather = require('weather').default;
const _getWeatherData = weather.getWeatherData.bind(weather);

function mapCondition(weatherConditionStr) {
  for (const weatherCondition of Object.keys(WeatherCondition)) {
    if (weatherCondition === weatherConditionStr) return WeatherCondition[weatherCondition];
  }
}

weather.getWeatherData = (...args) => {
  return _getWeatherData(...args).then((weatherData) => {
    for (const location of weatherData.locations) {
      const { weatherCondition } = location.currentWeather;
      if (typeof weatherCondition === 'string') location.currentWeather.weatherCondition = mapCondition(weatherCondition);
    }
    return weatherData;
  });
}

export default weather;
export { weather, TemperatureUnit, WeatherCondition };
`;

export default {
  weather: weatherPolyfill,
};
