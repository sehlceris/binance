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

    _setupWebSocket(eventHandler, relativePath, isCombined, reinitialize = false) {
        if (this._sockets[relativePath]) {
            if (reinitialize) {
                // console.log('reinitializing websocket');
                let wsToClose = this._sockets[relativePath];
                try {
                    wsToClose.terminate();
                    // console.log('websocket terminated');
                } catch (e) {
                    // console.log('error killing websocket: ' + e);
                }
                this._sockets[relativePath] = null;
            } else {
                return this._sockets[relativePath];
            }
        }
        else {
            // console.log('creating new websocket | reinitialize=' + reinitialize + ' path=' + relativePath);
        }
        const fullPath = (isCombined ? this._combinedBaseUrl : this._baseUrl) + relativePath;
        const ws = new WebSocket(fullPath);
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
        this._sockets[relativePath] = ws;
        return ws;
    }

    onDepthUpdate(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.depth(symbol), false, reinitialize);
    }

    onDepthLevelUpdate(symbol, level, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.depthLevel(symbol, level), false, reinitialize);
    }

    onKline(symbol, interval, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.kline(symbol, interval), false, reinitialize);
    }

    onAggTrade(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.aggTrade(symbol), false, reinitialize);
    }

    onTrade(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.trade(symbol), false, reinitialize);
    }

    onTicker(symbol, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.ticker(symbol), false, reinitialize);
    }

    onAllTickers(eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, this.streams.allTickers(), false, reinitialize);
    }

    onUserData(binanceRest, eventHandler, interval = 60000, reinitialize = false) {
        return binanceRest.startUserDataStream()
            .then((response) => {
                setInterval(() => {
                    binanceRest.keepAliveUserDataStream(response);
                }, interval);
                return this._setupWebSocket(eventHandler, response.listenKey, false, reinitialize);
            });
    }

    onCombinedStream(streams, eventHandler, reinitialize = false) {
        return this._setupWebSocket(eventHandler, streams.join('/'), true, reinitialize);
    }

}

module.exports = BinanceWS;
