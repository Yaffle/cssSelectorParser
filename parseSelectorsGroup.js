/*jslint regexp: true, vars: true, indent: 2 */

var parseSelectorsGroup = (function () {
  "use strict";

  var WHITESPACE = /^[ \t\r\n\f]+/;
  var PLUS = /^\+/;
  var TILDE = /^~/;
  var GREATER = /^>/;
  var ATTRIBUTE_OPERATOR = /^[\^\$\*~|]?\=/;
  var IDENT = /^\-?(?:[_a-z]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])(?:[_a-z0-9\-]|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*/i;
  var STRING = /^(?:\"([^\n\r\f\\"]|\\(?:\n|\r\n|\r|\f)|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*\"|\'([^\n\r\f\\']|\\(?:\n|\r\n|\r|\f)|[^\0-\177]|\\[0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?|\\[^\n\r\f0-9a-f])*\')/i;
  var COMMA = /^,/;
  var NOT = /^\:(?:n|\\0{0,4}(4e|6e)(\r\n|[ \t\r\n\f])?|\\n)(?:o|\\0{0,4}(4f|6f)(\r\n|[ \t\r\n\f])?|\\o)(?:t|\\0{0,4}(54|74)(\r\n|[ \t\r\n\f])?|\\t)\(/i;
  var C = /^[\s\S]/;
  var END = /^$/;

  var TOKENS = [WHITESPACE, PLUS, TILDE, GREATER, ATTRIBUTE_OPERATOR, IDENT, STRING, COMMA, NOT, C, END];

  function TokensQueue(s) {
    this.s = s;
    this.shift();
    this.shift();
  }

  TokensQueue.prototype = {
    s: null,
    token: null,
    tokenValue: null,
    nextToken: null,
    nextTokenValue: null,
    shift: function () {
      this.token = this.nextToken;
      this.tokenValue = this.nextTokenValue;
      var s = this.s;
      var l = TOKENS.length;
      var i = 0;
      while (i < l) {
        var t = TOKENS[i];
        var tmp = t.exec(s);
        if (tmp) {
          this.s = s.slice(tmp[0].length);
          this.nextToken = t;
          this.nextTokenValue = tmp[0];
          return;
        }
        i += 1;
      }
      this.token = null;
    },
    trimLeft: function () {
      if (this.token === WHITESPACE) {
        this.shift();
      }
    }
  };

  function unescapeIdent(s) {
    return s.replace(/\\([0-9a-f]{1,6})(?:\r\n|[ \n\r\t\f])?|\\([^\n\r\f0-9a-f])/gi, function (a, b, c) {
      return b ? String.fromCharCode(parseInt(b, 16)) : c;
    });
  }

  function unescapeString(s) {
    return unescapeIdent(s.replace(/\\(\n|\r\n|\r|\f)/g, ''));
  }

  function parseTypeSelector(q) {
    if (q.token !== IDENT) {
      return null;
    }
    var tmp = unescapeIdent(q.tokenValue);
    q.shift();
    return tmp;
  }

  function parseClassSelector(q) {
    if (q.token === C && q.tokenValue === '.') {
      q.shift();
      if (q.token !== IDENT) {
        return null;
      }
      var tmp = unescapeIdent(q.tokenValue);
      q.shift();
      return tmp;
    }
    return null;
  }

  function parseAttributeSelector(q) {
    if (!(q.token === C && q.tokenValue === '[')) {
      return null;
    }
    q.trimLeft();
    if (q.token !== IDENT) {
      return null;
    }
    var result = {
      name: '',
      operator: '',
      value: ''
    };
    result.name = unescapeIdent(q.tokenValue);
    q.shift();
    q.trimLeft();
    if (q.token === ATTRIBUTE_OPERATOR) {
      result.operator = q.tokenValue;
      q.shift();
      q.trimLeft();
      if (q.token === IDENT) {
        result.value = unescapeIdent(q.tokenValue);
      } else {
        if (q.token !== STRING) {
          return null;
        }
        result.value = unescapeString(q.tokenValue.slice(1, -1));
      }
      q.shift();
      q.trimLeft();
    }
    if (!(q.token === C && q.tokenValue === ']')) {
      return null;
    }
    q.shift();
    return result;
  }

  function parseNegation(q) {
    if (q.token !== NOT) {
      return null;
    }
    q.shift();
    q.trimLeft();
    var tmp = parseSimpleSelectorSequence(q, null);
    if (!tmp) {
      return null;
    }
    q.trimLeft();
    if (!(q.token === C && q.tokenValue === ')')) {
      return null;
    }
    q.shift();
    return tmp;
  }

  function parseSimpleSelectorSequence(q, combinator) {
    var tmp = parseTypeSelector(q);
    if (!tmp && q.token === C && q.tokenValue === '*') {
      tmp = '*';
      q.shift();
    }
    var result = {
      combinator: combinator,
      typeSelector: tmp || '*',
      classSelectors: [],
      attributeSelectors: [],
      negations: []
    };
    var wasSomething = !!tmp;
    while (true) {
      tmp = parseClassSelector(q);
      if (!tmp) {
        tmp = parseAttributeSelector(q);
        if (!tmp) {
          tmp = parseNegation(q);
          if (!tmp) {
            break;
          } else {
            result.negations.push(tmp);
          }
        } else {
          result.attributeSelectors.push(tmp);
        }
      } else {
        result.classSelectors.push(tmp);
      }
      wasSomething = true;
    }
    if (!wasSomething) {
      return null;
    }
    return result;
  }

  function parseSelector(q, firstCombinator, token1, token2, parseNext) {
    var tmp = parseNext(q, firstCombinator);
    if (!tmp) {
      return null;
    }
    var selectorSequences = [];
    selectorSequences.push(tmp);
    while (true) {
      var token = q.token;
      var nextToken = q.nextToken;
      if (token === WHITESPACE && nextToken === END) {
        q.shift();
        break;
      }
      var needsShift = token === WHITESPACE && (nextToken === PLUS || nextToken === TILDE || nextToken === GREATER);
      if (needsShift) {
        token = nextToken;
      }
      if (token !== token1 && token !== token2) {
        break;
      }
      if (needsShift) {
        q.shift();
      }
      var tokenValue = token === WHITESPACE ? ' ' : q.tokenValue;
      q.shift();
      q.trimLeft();
      tmp = parseNext(q, tokenValue);
      if (!tmp) {
        return null;
      }
      selectorSequences.push(tmp);
    }
    return selectorSequences;
  }

  function parseSiblingsSelector(s, combinator) {
    var tmp = parseSelector(s, combinator, PLUS, TILDE, parseSimpleSelectorSequence);
    if (!tmp) {
      return null;
    }
    return {
      combinator: combinator,
      simpleSelectorSequences: tmp
    };
  }

  return function parseSelectorsGroup(s) {
    var q = new TokensQueue(String(s));
    q.trimLeft();
    var tmp = parseSelector(q, ' ', GREATER, WHITESPACE, parseSiblingsSelector);
    if (!tmp) {
      return null;
    }
    var result = [];
    result.push(tmp);
    q.trimLeft();
    while (q.token !== END) {
      if (q.token !== COMMA) {
        return null;
      }
      q.shift();
      q.trimLeft();
      tmp = parseSelector(q, ' ', GREATER, WHITESPACE, parseSiblingsSelector);
      if (!tmp) {
        return null;
      }
      result.push(tmp);
      q.trimLeft();
    }
    return result;
  };

}());

/*

console.log(JSON.stringify(parseSelectorsGroup('a[href^="ya.ru+ "] ~ b, a.test'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('.\\=\\][tes\\t]'), null, 2));
console.log(JSON.stringify(parseSelectorsGroup('h1, h2, ul > li, .things'), null, 2));

*/
