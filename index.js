var util = require('util')
  , format = util.format.bind(util)
  , db

module.exports = function (id, opts) {
  opts = opts || {}
  opts.inner = opts.inner || 'membership'
  opts.outer = opts.outer || 'members'
  return new Node(String(id), opts)
}

module.exports.setClient = function (client) {
  db = client
}

function Node (id, opts) {
  var me = this
  this.id = id
  Object.defineProperty(me, 'inner', {
      value : opts.inner
    , enumerable : false
    , writable : true
  })
  Object.defineProperty(me, 'outer', {
      value : opts.outer
    , enumerable : false
    , writable : true
  })
  Object.defineProperty(me, this.inner, {
      value : new Edge({ inner : this.inner, outer : this.outer, id : id })
    , enumerable : false
    , writable : true
  })
  Object.defineProperty(me, this.outer, {
      value : new Edge({ inner : this.outer, outer : this.inner, id : id })
    , enumerable : false
    , writable : true
  })
}

Node.prototype.toString = function (cb) {
  return this.id
}

Node.prototype.delete = function (cb) {
  var me = this
  db.multi()
    .smembers([ me[me.inner].innerkey ])
    .smembers([ me[me.outer].innerkey ])
    .exec(function (error, replies) {
      var multi = db.multi()
      replies.forEach(function (reply) {
        reply.forEach(function (gid) {
          multi
            .srem([ format(me.inner + '_%s', gid), me.id ])
            .srem([ format(me.outer + '_%s', gid), me.id ])
            .srem([ me[me.inner].innerkey, gid ])
            .srem([ me[me.outer].innerkey, gid ])
        })
      })
      multi.exec(cb)
    })
  ;
}

function Edge (opts) {
  this.id = opts.id
  this.innerformat = opts.inner + '_%s'
  this.outerformat = opts.outer + '_%s'
  this.innerkey = format(this.innerformat, this.id)
  this.outerkey = format(this.outerformat, this.id)
  // this[opts.inner] = function (id, cb) {
    // db.sinter([ format(this.innerformat, String(id)), this.outerkey ], cb)
  // }
  // this[opts.outer] = function (id, cb) {
    // db.sinter([ format(this.innerformat, String(id)), this.innerkey ], cb)
  // }
  // this[opts.inner + '_with'] = function (id, cb) {
    // db.sinter([ format(this.outerformat, String(id)), this.innerkey ], cb)
  // }
  // this[opts.outer + '_with'] = function (id, cb) {
    // db.sinter([ format(this.outerformat, String(id)), this.outerkey ], cb)
  // }
  this[opts.inner] = function (cb) {
    this.all(function (error, array) {
      if (error) return cb(error)
      if (!array || !array.length) return cb(null, array || [])
      array = array.map(function (gid) { return format(this.innerformat, String(gid)) }, this)
      db.sunion(array, cb)
    }.bind(this))
  }
  this[opts.outer] = function (cb) {
    this.all(function (error, array) {
      if (error) return cb(error)
      if (!array || !array.length) return cb(null, array || [])
      array = array.map(function (gid) { return format(this.outerformat, gid) }, this)
      db.sunion(array, cb)
    }.bind(this))
  }
}

// Edge.prototype.with = function (id, cb) { 
  // db.sinter([ format(this.outerformat, String(id)), this.outerkey ], cb)
// }

Edge.prototype.all = function (cb) { 
  db.smembers([ this.innerkey ], cb)
}

Edge.prototype.add = function (reverse, cb) { 
  db.multi()
    .sadd([ this.innerkey, String(reverse) ])
    .sadd([ format(this.outerformat, String(reverse)), this.id ])
    .exec(cb)
}

Edge.prototype.delete = function (reverse, cb) { 
  db.multi()
    .srem([ this.innerkey, String(reverse) ])
    .srem([ format(this.outerformat, String(reverse)), this.id ])
    .exec(cb)
}

Edge.prototype.without = function (arr, cb) {
  arr = Array.isArray(arr) ? arr : [ arr ]
  arr = arr.map(function (gid) { return format(this.innerformat, String(gid)) }, this)
  arr.unshift(this.innerkey)
  db.sdiff(arr, cb)
}

Edge.prototype.intersect = function (arr, cb) {
  arr = Array.isArray(arr) ? arr : [ arr ]
  arr = arr.map(function (gid) { return format(this.innerformat, String(gid)) }, this)
  arr.unshift(this.innerkey)
  db.sinter(arr, cb)
}

Edge.prototype.union = function (arr, cb) {
  arr = Array.isArray(arr) ? arr : [ arr ]
  arr = arr.map(function (gid) { return format(this.innerformat, String(gid)) }, this)
  arr.unshift(this.innerkey)
  db.sunion(arr, cb)
}

// Edge.prototype.toNodes = function toNodes (cb) {
//   return function (error, array) {
//     if (error) return cb(error, array)
//     cb(null, array.map(function (gid) {
//       return this.Node(gid)
//     }, this))
//   }.bind(this)
// }
