const WebSocket = require('ws');
const Beautifier = require('./beautifier.js');
const _ = require('underscore');

class BinanceWS {

    constructor(beautify = true) {
        this._baseUrl = 'wss://stream.binance.com:9443/ws/';
        this._combinedBaseUrl = 'wss://stream.binance.com:9443/stream?streams=';
        this._sockets = {};
        this._beautifier = new Beautifier();
        this._beautify = beautify;

        this.streams = {
            depth: (symbol) => `${symbol.toLowerCase()}@depth`,
            depthLevel: (symbol, level) => `${symbol.toLowerCase()}@depth${level}`,
            kline: (symbol, interval) => `${symbol.toLowerCase()}@kline_${interval}`,
            aggTrade: (symbol) => `${symbol.toLowerCase()}@aggTrade`,
            trade: (symbol) => `${symbol.toLowerCase()}@trade`,
            ticker: (symbol) => `${symbol.toLowerCase()}@ticker`,
            allTickers: () => '!ticker@arr'
        };
    }

    _setupWebSocket(eventHandler, path, isCombined, reinitialize = false) {
        if (this._sockets[path]) {
            if (reinitialize) {
                let wsToClose = this._sockets[path];
                try {
                    wsToClose.terminate();
                } catch (e) {
                    // we are fine with this error
                }
                this._sockets[path] = null;
            } else {
                return this._sockets[path];
            }
        }
        path = (isCombined ? this._combinedBaseUrl : this._baseUrl) + path;
        const ws = new WebSocket(path);
        ws.on('message', (json) => {
            let response = JSON.parse(json);
            if (this._beautify) {
                if (response.stream && response.data.e) {
                    response.data = this._beautifier.beautify(response.data, response.data.e + 'Event');
                } else if (_.isArray(response)) {
                    response = _.map(response, event => {
                        if (event.e) {
                            return this._beautifier.beautify(event, event.e + 'Event');
                        }
                        return event;
                    });
                } else if (response.e) {
                    response = this._beautifier.beautify(response, response.e + 'Event');
                }
            }

            eventHandler(response);
        });
        return ws;
    }

    onDepthUpdate(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.depth(symbol), reinitialize);
    }

    onDepthLevelUpdate(symbol, level, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.depthLevel(symbol, level), reinitialize);
    }

    onKline(symbol, interval, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.kline(symbol, interval), reinitialize);
    }

    onAggTrade(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.aggTrade(symbol), reinitialize);
    }

    onTrade(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.trade(symbol), reinitialize);
    }

    onTicker(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.ticker(symbol), reinitialize);
    }

    onAllTickers(eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.allTickers(), reinitialize);
    }

    onUserData(binanceRest, eventHandler, interval = 60000, reinitialize = false) {
        return binanceRest.startUserDataStream()
            .then((response) => {
                setInterval(() => {
                    binanceRest.keepAliveUserDataStream(response);
                }, interval);
                return this._setupWebSocket(eventHandler, response.listenKey, reinitialize);
            });
    }

    onCombinedStream(streams, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, streams.join('/'), true, reinitialize);
    }

}

module.exports = BinanceWS;
