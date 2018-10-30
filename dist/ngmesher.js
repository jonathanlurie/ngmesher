(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.ngmesher = factory());
}(this, (function () { 'use strict';

  function sliceTypedArray(buffer, byteOffset, arrayType, nbElements, littleEndian=true) {
    let array = new arrayType(nbElements);
    let bytesPerElements = array.BYTES_PER_ELEMENT;
    let dataView = new DataView(buffer);

    let viewExtractMethods = {
      'Int8Array'    : 'getInt8',
      'Uint8Array'   : 'getUint8',
      'Int16Array'   : 'getInt16',
      'Uint16Array'  : 'getUint16',
      'Int32Array'   : 'getInt32',
      'Uint32Array'  : 'getUint32',
      'Float32Array' : 'getFloat32',
      'Float64Array' : 'getFloat64',
    };

    let viewExtractMethod = viewExtractMethods[array.constructor.name];

    for (let i=0; i<nbElements; i+=1) {
      array[i] = dataView[viewExtractMethod](byteOffset + i * bytesPerElements, littleEndian);
    }

    return array
  }

  /**
   * Insert the content of a typed array into a buffer. If the buffer if not large enough
   * to receive the array, an error is thown.
   * Nothing is returned, the buffer in arguments is modified on place.
   * @param {ArrayBuffer} buffer - a buffer
   * @param {Number} byteOffset - the byte positions to start writing the array data in the buffer
   * @param {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array} array - a typed array
   * @param {Boolean} littleEndian - will write in a little-endian fashion if true, or in a big-endian fashion if false
   */
  function insertTypedArray(buffer, byteOffset, array, littleEndian=true) {
    // check if it fits
    if ((buffer.byteLength - byteOffset) < array.byteLength ) {
      throw "The buffer is not large enough to receive the content of the given array."
      return
    }

    let bytesPerElements = array.BYTES_PER_ELEMENT;
    let dataView = new DataView(buffer);

    let viewInsertMethods = {
      'Int8Array'    : 'setInt8',
      'Uint8Array'   : 'setUint8',
      'Int16Array'   : 'setInt16',
      'Uint16Array'  : 'setUint16',
      'Int32Array'   : 'setInt32',
      'Uint32Array'  : 'setUint32',
      'Float32Array' : 'setFloat32',
      'Float64Array' : 'setFloat64',
    };

    let viewInsertMethod = viewInsertMethods[array.constructor.name];

    let movingByteOffset = byteOffset;
    for (let i=0; i<array.length; i+=1) {
      array[i] = dataView[viewInsertMethod](movingByteOffset, array[i], littleEndian);
      movingByteOffset += bytesPerElements;
    }
  }


  function decode (buffer) {

    // 1 x uint32 : the number of vertices
    let nbVertices = sliceTypedArray(buffer, 0, Uint32Array, 1)[0];

    // 3 x nbVertices x float32 : the vertices positions as [x, y, z, x, y, x, ...]
    let vertices = sliceTypedArray(buffer, 4, Float32Array, nbVertices * 3);
    let byteOffset = 4 + vertices.byteLength;

    // find the number of triangles
    let nbTriangles = (buffer.byteLength - byteOffset) / 12;

    let triangles = sliceTypedArray(buffer, byteOffset, Uint32Array, nbTriangles*3);

    return {
      vertices: vertices,
      triangles: triangles
    }
  }


  function encode(vertices, triangles) {
    let verticesCompatible = vertices;
    let trianglesCompatible = triangles;

    if (vertices.constructor !== Float32Array) {
      console.warn("Make sure your vertices array is float32 compatible.");
      verticesCompatible = new Float32Array(vertices);
    }

    if (triangles.constructor !== Uint32Array) {
      console.warn("Make sure your triangle array is uint32 compatible.");
      trianglesCompatible = new Uint32Array(triangles);
    }

    let bufferbyteLength = 4 + verticesCompatible.byteLength + trianglesCompatible.byteLength;
    let buffer = new ArrayBuffer(bufferbyteLength);

    // lets write thing in this buffer
    // 1. the number of vertices:
    insertTypedArray(buffer, 0, new Uint32Array([verticesCompatible.length/3]));

    // 2. add the vertices
    insertTypedArray(buffer, 4, verticesCompatible);

    // 3. add the triangles
    insertTypedArray(buffer, 4 + verticesCompatible.byteLength, trianglesCompatible);

    return buffer
  }



  var index = ({
    decode,
    encode
  });

  return index;

})));
//# sourceMappingURL=ngmesher.js.map
