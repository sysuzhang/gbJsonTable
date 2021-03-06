var url = require('url');
var fs = require('fs');
var renderInfo = false;
var renderGenerate = false;

var col = ['name', 'type', 'isOptional', 'primary key', 'description'];

function wrapTdOpt(o, def, opt) {
    if (o === undefined) {
        // undefinedではなく別の文字にしてもいいかも
        return '<td>' + def + '</td>';
    }
    if (opt) {
        return '<td align="' + opt + '">' + o + '</td>';
    }
    return '<td>' + o + '</td>';
}

// ElementsRender系
function wrapTd(o, opt) {
    if (o === undefined) {
        // undefinedではなく別の文字にしてもいいかも
        return '<td style="color:red;">' + o + '</td>';
    }
    if (opt) {
        return '<td align="' + opt + '">' + o + '</td>';
    }
    return '<td>' + o + '</td>';
}

function wrapTh(o) {
    return '<th>' + o + '</th>';
}

function isPrimaryKey(obj) {
    if (!obj.tag) return false;
    for (i = 0; i < obj.tag.length; i++) {
        if (obj.tag[i] === "primary key") {
            return true;
        }
    }
    return false;
}

function parseElement(name, obj) {
    var result = wrapTd(name);
    // colに対応した要素を追加していく
    result += wrapTd(obj.type);
    result += wrapTdOpt(obj.isOptional, "false");

    if (isPrimaryKey(obj)) {
        result += wrapTd("O", "center");
    } else {
        result += wrapTd(" ");
    }

    result += wrapTdOpt(obj.description, " ");
    if (obj.type === "dictionary") {
        result += '</tr><tr>';
        for (k in obj.members) {
            result += parseElement(name + '.' + k, obj.members[k]) + '</tr>';
        }
    } else if (obj.type === "array") {
        for (var i = 0; i < obj.members.length; i++) {
            result += wrapTd("");
            result += wrapTd(obj.members[i]);
            result += wrapTd("");
            result += wrapTd("") + '</tr>';
        }
    }
    return result;
}

function parseElements(obj, type) {
    if (type === "RDB") {
        return createTable(obj);
    } else if (type === "KVS") {
        return createJsonCode(obj);
    }
    return "Unknown type";
}

function createTable(obj) {
    var result = '<table>\n';
    result += '<tr>';
    for (i = 0; i < col.length; i++) {
        result += wrapTh(col[i]);
    }
    result += '</tr>';

    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            result += '<tr>' + parseElement(key, obj[key]) + '</tr>\n';
        }
    }
    result += '</table>';
    return result;
}

function expandEntity(obj) {
    var res = {};
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (obj[key].type === "dictionary") {
                res[key] = expandEntity(obj[key].members);
            } else {
                res[key] = obj[key].sample;
            }
        }
    }
    return res;
}

function createJsonCode(obj) {
    var result = '<pre><code class="json">';
    result += JSON.stringify(expandEntity(obj), null, "	 ");
    result += '</code></pre>';
    return result;
}


// Meta情報Render系
function parseMeta(meta) {
    var result = '<h1>' + meta.name + '</h1>' + meta.description + '\n';
    result += '<h2>version</h2><h5>' + meta.version + '</h5>';
    return result;
}


// SQL 自動生成等
function sqlArgument(name, obj) {
    if (!obj.isOptional) {
        return '`' + name + '` ' + obj.type + ' not null';
    }
    return '`' + name + '` ' + obj.type;
}

function createSQL(name, obj) {
    var result = '<pre><code class="lang-sql"> create table ';
    result += name + '(';
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            result += ' ' + sqlArgument(key, obj[key]) + ',';
        }
    }
    result = result.substring(0, result.length - 1);
    result += '); </code></pre>';
    return result;
}

module.exports = {
    hooks: {
        init: function () {
            if (this.options.pluginsConfig && this.options.pluginsConfig.gbJsonTable) {
                var gbJsonTable = this.options.pluginsConfig.gbJsonTable;
                if (gbJsonTable.render) {
                    var render = jsoneon.render;
                    for (i = 0; i < render.length; i++) {
                        if (render[i] === "info") {
                            renderInfo = true;
                        } else if (render[i] === "generate") {
                            renderGenerate = true;
                        }
                    }
                }
            }
        }
    },
    blocks: {
        gbJsonTable: {
            process: function (block) {
                if ("src" in block.kwargs) {
                    var json = require(
                        this.book.root + '/' + block.kwargs.src
                    );
                    var result = "";
                    if (renderInfo) {
                        result += parseMeta(json.meta);
                    }
                    result += parseElements(json.elements, json.meta.type);
                    if (renderGenerate) {
                        result += createSQL(json.meta.name);
                    }
                    return result;
                }
                return "Needs filename";
            }
        }
    }
};

