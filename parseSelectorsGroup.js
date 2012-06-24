
var parseSelectorsGroup = (function () {

  var ident = /^\-?(?:[_a-z]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])(?:[_a-z0-9\-]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*/i;
  var string1 = (/\"([^\n\r\f\\"]|\\(?:\n|\r\n|\r|\f)|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*\"/).source;
  var cssString = new RegExp('^(?:' + string1 + '|' + string1.replace(/"/g, "'") + ')', 'i');

  function unescapeIdent(s) {
    return s.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \n\r\t\f])?|\\([^\n\r\f0-9a-f])/gi, function (a, b, c) {
      return b ? String.fromCharCode(parseInt(b, 16)) : c;
    });
  }

  function unescapeString(s) {
    return unescapeIdent(s.replace(/\\(\n|\r\n|\r|\f)/g, ''));
  }

  function parseTypeSelector(s) {
    var tmp = ident.exec(s);
    return tmp ? unescapeIdent(tmp[0]) : null;
  }

  function parseClassSelector(s) {
    if (s.slice(0, 1) === '.') {
      s = s.slice(1);
      var tmp = ident.exec(s);
      return !tmp ? null : {
        raw: '.' + tmp[0],
        className: unescapeIdent(tmp[0])
      };
    }
    return null;
  }

  function parseAttributeSelector(s) {
    var src = s;
    var tmp = (/^\[[ \t\r\n\f]*/).exec(s);
    if (!tmp) {
      return null;
    }
    s = s.slice(tmp.length);
    var tmp = ident.exec(s);
    if (!tmp) {
      return null;
    }
    var result = {
      raw: '',
      name: '',
      operator: '',
      value: ''
    };
    result.name = unescapeIdent(tmp[0]);
    s = s.slice(tmp[0].length);
    s = s.replace(/^[ \t\r\n\f]+/, '');
    tmp = (/^[\^\$\*~|]?\=/).exec(s);
    if (tmp) {
      result.operator = tmp[0];
      s = s.slice(tmp[0].length);
      s = s.replace(/^[ \t\r\n\f]+/, '');
      tmp = ident.exec(s);
      if (tmp) {
        result.value = unescapeIdent(tmp[0]);
        s = s.slice(tmp[0].length);
      } else {
        tmp = cssString.exec(s);
        if (!tmp) {
          return null;
        }
        result.value = unescapeString(tmp[0].slice(1, -1));
        s = s.slice(tmp[0].length);
      }
    }
    tmp = (/^[ \t\r\n\f]*\]/).exec(s);
    if (!tmp) {
      return null;
    }
    s = s.slice(tmp.length);
    result.raw = s.length ? src.slice(0, -s.length) : src;
    return result;
  }

  function parseSimpleSelectorSequence(s) {
    var src = s;
    var tmp = s === '*' ? '*' : parseTypeSelector(s);
    var result = {
      raw: '',
      typeSelector: tmp || '*',
      classSelectors: [],
      attributeSelectors: []
    };
    var wasSomething = !!tmp;
    if (tmp) {
      s = s.slice(tmp.length);
    }
    while (true) {
      tmp = parseClassSelector(s);
      if (!tmp) {
        tmp = parseAttributeSelector(s);
        if (!tmp) {
          break;
        } else {
          result.attributeSelectors.push(tmp);
          s = s.slice(tmp.raw.length);
        }
      } else {
        result.classSelectors.push(tmp);
        s = s.slice(tmp.raw.length);
      }
      wasSomething = true;
    }
    if (!wasSomething) {
      return null;
    }
    result.raw = s.length ? src.slice(0, -s.length) : src;
    return result;
  }

  function parseSelector(s) {
    var src = s;
    var tmp = parseSimpleSelectorSequence(s);
    if (!tmp) {
      return null;
    }
    var result = {
      raw: '',
      simpleSelectorSequences: [],
      combinators: []
    };
    s = s.slice(tmp.raw.length);
    result.simpleSelectorSequences.push(tmp);
    var combinator = /^(?:[ \t\r\n\f]*([\+>~])[ \t\r\n\f]*|[ \t\r\n\f]+)/;
    while (s !== '') {
      tmp = combinator.exec(s);
      if (!tmp) {
        break;
      }
      s = s.slice(tmp[0].length);
      result.combinators.push(tmp[1] || ' ');
      tmp = parseSimpleSelectorSequence(s);
      if (!tmp) {
        return null;
      }
      result.simpleSelectorSequences.push(tmp);
      s = s.slice(tmp.raw.length);
    }
    result.raw = s.length ? src.slice(0, -s.length) : src;
    return result;
  }

  return function parseSelectorsGroup(s) {
    s = String(s).replace(/^\s+|\s+$/, '');
    var tmp = parseSelector(s);
    if (!tmp) {
      return null;
    }
    var result = {
      selectors: []
    };
    result.selectors.push(tmp);
    s = s.slice(tmp.raw.length);
    var comma = /^[ \t\r\n\f]*,[ \t\r\n\f]*/;
    while (s !== '') {
      tmp = comma.exec(s);
      if (!tmp) {
        return null;
      }
      s = s.slice(tmp[0].length);
      tmp = parseSelector(s);
      if (!tmp) {
        return null;
      }
      result.selectors.push(tmp);
      s = s.slice(tmp.raw.length);
    }
    return result;
  };

}());

/*

console.log(JSON.stringify(parseSelectorsGroup('a[href^="ya.ru+ "] ~ b, a.test'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('.\\=\\][tes\\t]'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('h1, h2, ul > li, .things'), null, 2));

*/
