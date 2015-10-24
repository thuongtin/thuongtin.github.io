'use strict';

function promisifyRequest(obj) {
  return new Promise(function(resolve, reject) {
    function onsuccess(event) {
      resolve(obj.result);
      unlisten();
    }
    function onerror(event) {
      reject(obj.error);
      unlisten();
    }
    function unlisten() {
      obj.removeEventListener('complete', onsuccess);
      obj.removeEventListener('success', onsuccess);
      obj.removeEventListener('error', onerror);
      obj.removeEventListener('abort', onerror);
    }
    obj.addEventListener('complete', onsuccess);
    obj.addEventListener('success', onsuccess);
    obj.addEventListener('error', onerror);
    obj.addEventListener('abort', onerror);
  });
}

function IndexDBWrapper(name, version, upgradeCallback) {
  var request = indexedDB.open(name, version);
  this.ready = promisifyRequest(request);
  request.onupgradeneeded = function(event) {
    upgradeCallback(request.result, event.oldVersion);
  };
}

IndexDBWrapper.supported = 'indexedDB' in self;

var IndexDBWrapperProto = IndexDBWrapper.prototype;

IndexDBWrapperProto.transaction = function(stores, modeOrCallback, callback) {
  return this.ready.then(function(db) {
    var mode = 'readonly';

    if (modeOrCallback.apply) {
      callback = modeOrCallback;
    }
    else if (modeOrCallback) {
      mode = modeOrCallback;
    }

    var tx = db.transaction(stores, mode);
    var val = callback(tx, db);
    var promise = promisifyRequest(tx);
    var readPromise;

    if (!val) {
      return promise;
    }

    if (val[0] && 'result' in val[0]) {
      readPromise = Promise.all(val.map(promisifyRequest));
    }
    else {
      readPromise = promisifyRequest(val);
    }

    return promise.then(function() {
      return readPromise;
    });
  });
};

IndexDBWrapperProto.get = function(store, key) {
  return this.transaction(store, function(tx) {
    return tx.objectStore(store).get(key);
  });
};

IndexDBWrapperProto.put = function(store, key, value) {
  return this.transaction(store, 'readwrite', function(tx) {
    tx.objectStore(store).put(value, key);
  });
};

IndexDBWrapperProto.delete = function(store, key) {
  return this.transaction(store, 'readwrite', function(tx) {
    tx.objectStore(store).delete(key);
  });
};