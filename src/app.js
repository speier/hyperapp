import { h } from "./h"

var callbacks = []

export function app(props) {
  if (typeof props === "function") {
    return props(app)
  }

  var globalState
  var globalActions

  var root = props.root || document.body
  var element = root.children[0]
  var node = elementToNode(element, [].map)
  var skipRender

  repaint(flush(init(props, (globalState = {}), (globalActions = {}))))

  return globalActions

  function repaint() {
    if (props.view && !skipRender) {
      requestAnimationFrame(render, (skipRender = !skipRender))
    }
  }

  function render() {
    flush(
      (element = patch(
        root,
        element,
        node,
        (node = props.view(globalState, globalActions)),
        (skipRender = !skipRender)
      ))
    )
  }

  function flush(cb) {
    while ((cb = callbacks.pop())) cb()
  }

  function elementToNode(element, map) {
    return (
      element &&
      h(
        element.tagName.toLowerCase(),
        {},
        map.call(element.childNodes, function(element) {
          return element.nodeType === 3
            ? element.nodeValue
            : elementToNode(element, map)
        })
      )
    )
  }

  function init(module, state, actions) {
    if (module.init) {
      callbacks.push(function() {
        module.init(state, actions)
      })
    }

    assign(state, module.state)

    initActions(state, actions, module.actions)

    Object.keys(module.modules || {}).map(function(i) {
      init(module.modules[i], (state[i] = {}), (actions[i] = {}))
    })
  }

  function initActions(state, actions, source) {
    Object.keys(source || {}).map(function(i) {
      typeof source[i] === "function"
        ? (actions[i] = function(data) {
            return typeof (data = source[i](state, actions, data)) === "function"
              ? data(update)
              : update(data)
          })
        : initActions(state[i] || (state[i] = {}), (actions[i] = {}), source[i])
    })

    function update(data) {
      return (
        typeof data === "function"
          ? update(data(state))
          : data && repaint(assign(state, data)),
        globalState
      )
    }
  }

  function assign(target, source) {
    for (var i in source) {
      target[i] = source[i]
    }
    return target
  }

  function merge(target, source) {
    return assign(assign({}, target), source)
  }

  function createElement(node, isSVG) {
    if (typeof node === "string") {
      var element = document.createTextNode(node)
    } else {
      var element = (isSVG = isSVG || node.type === "svg")
        ? document.createElementNS("http://www.w3.org/2000/svg", node.type)
        : document.createElement(node.type)

      if (node.props && node.props.oncreate) {
        callbacks.push(function() {
          node.props.oncreate(element)
        })
      }

      for (var i = 0; i < node.children.length; i++) {
        element.appendChild(createElement(node.children[i], isSVG))
      }

      for (var i in node.props) {
        setElementProp(element, i, node.props[i])
      }
    }
    return element
  }

  function setElementProp(element, name, value, oldValue) {
    if (name === "key") {
    } else if (name === "style") {
      for (var name in merge(oldValue, (value = value || {}))) {
        element.style[name] = value[name] || ""
      }
    } else {
      try {
        element[name] = value
      } catch (_) {}

      if (typeof value !== "function") {
        if (value) {
          element.setAttribute(name, value)
        } else {
          element.removeAttribute(name)
        }
      }
    }
  }

  function updateElement(element, oldProps, props) {
    for (var i in merge(oldProps, props)) {
      var value = props[i]
      var oldValue = i === "value" || i === "checked" ? element[i] : oldProps[i]

      if (value !== oldValue) {
        value !== oldValue && setElementProp(element, i, value, oldValue)
      }
    }

    if (props && props.onupdate) {
      callbacks.push(function() {
        props.onupdate(element, oldProps)
      })
    }
  }

  function removeElement(parent, element, props) {
    if (
      props &&
      props.onremove &&
      typeof (props = props.onremove(element)) === "function"
    ) {
      props(remove)
    } else {
      remove()
    }

    function remove() {
      parent.removeChild(element)
    }
  }

  function getKey(node) {
    if (node && node.props) {
      return node.props.key
    }
  }

  function patch(parent, element, oldNode, node, isSVG, nextSibling) {
    if (oldNode == null) {
      element = parent.insertBefore(createElement(node, isSVG), element)
    } else if (node.type != null && node.type === oldNode.type) {
      updateElement(element, oldNode.props, node.props)

      isSVG = isSVG || node.type === "svg"

      var len = node.children.length
      var oldLen = oldNode.children.length
      var oldKeyed = {}
      var oldElements = []
      var keyed = {}

      for (var i = 0; i < oldLen; i++) {
        var oldElement = (oldElements[i] = element.childNodes[i])
        var oldChild = oldNode.children[i]
        var oldKey = getKey(oldChild)

        if (null != oldKey) {
          oldKeyed[oldKey] = [oldElement, oldChild]
        }
      }

      var i = 0
      var j = 0

      while (j < len) {
        var oldElement = oldElements[i]
        var oldChild = oldNode.children[i]
        var newChild = node.children[j]

        var oldKey = getKey(oldChild)
        if (keyed[oldKey]) {
          i++
          continue
        }

        var newKey = getKey(newChild)

        var keyedNode = oldKeyed[newKey] || []

        if (null == newKey) {
          if (null == oldKey) {
            patch(element, oldElement, oldChild, newChild, isSVG)
            j++
          }
          i++
        } else {
          if (oldKey === newKey) {
            patch(element, keyedNode[0], keyedNode[1], newChild, isSVG)
            i++
          } else if (keyedNode[0]) {
            element.insertBefore(keyedNode[0], oldElement)
            patch(element, keyedNode[0], keyedNode[1], newChild, isSVG)
          } else {
            patch(element, oldElement, null, newChild, isSVG)
          }

          j++
          keyed[newKey] = newChild
        }
      }

      while (i < oldLen) {
        var oldChild = oldNode.children[i]
        var oldKey = getKey(oldChild)
        if (null == oldKey) {
          removeElement(element, oldElements[i], oldChild.props)
        }
        i++
      }

      for (var i in oldKeyed) {
        var keyedNode = oldKeyed[i]
        var reusableNode = keyedNode[1]
        if (!keyed[reusableNode.props.key]) {
          removeElement(element, keyedNode[0], reusableNode.props)
        }
      }
    } else if (element && node !== element.nodeValue) {
      if (typeof node === "string" && typeof oldNode === "string") {
        element.nodeValue = node
      } else {
        element = parent.insertBefore(
          createElement(node, isSVG),
          (nextSibling = element)
        )
        removeElement(parent, nextSibling, oldNode.props)
      }
    }
    return element
  }
}
