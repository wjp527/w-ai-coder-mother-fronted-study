/**
 * 可视化编辑器工具
 * 用于处理 iframe 中的元素选择和与主网站的通信
 */

export interface SelectedElement {
  tagName: string
  id?: string
  className?: string
  textContent?: string
  xpath?: string
  selector?: string
}

/**
 * 在 iframe 中注入可视化编辑脚本
 * @param iframe iframe 元素
 * @param onElementSelected 元素选择回调
 * @returns 清理函数
 */
export function injectVisualEditorScript(
  iframe: HTMLIFrameElement,
  onElementSelected: (element: SelectedElement) => void
): () => void {
  if (!iframe.contentWindow) {
    return () => { }
  }

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document

    // 注入样式
    const style = iframeDoc.createElement('style')
    style.textContent = `
      .visual-editor-hover {
        outline: 2px solid #1890ff !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
      }
      .visual-editor-selected {
        outline: 3px solid #ff4d4f !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
        background-color: rgba(255, 77, 79, 0.1) !important;
      }
    `
    iframeDoc.head.appendChild(style)

    let hoveredElement: HTMLElement | null = null
    let selectedElement: HTMLElement | null = null

    // 获取元素的 XPath
    function getXPath(element: Element): string {
      if (element.id) {
        return `//*[@id="${element.id}"]`
      }

      if (element === iframeDoc.body) {
        return '/html/body'
      }

      if (element === iframeDoc.documentElement) {
        return '/html'
      }

      let ix = 0
      const siblings = element.parentNode?.childNodes || []
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i]
        if (sibling === element) {
          const parentXPath = element.parentNode && element.parentNode.nodeType === Node.ELEMENT_NODE
            ? getXPath(element.parentNode as Element)
            : ''
          return parentXPath + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']'
        }
        if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === element.tagName) {
          ix++
        }
      }
      return ''
    }

    // 获取元素的 CSS 选择器
    function getSelector(element: Element): string {
      if (element.id) {
        return `#${element.id}`
      }

      const path: string[] = []
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase()

        if (element.className) {
          const classes = Array.from(element.classList)
            .filter(cls => !cls.startsWith('visual-editor-'))
            .join('.')
          if (classes) {
            selector += `.${classes}`
          }
        }

        let sibling = element
        let nth = 1
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling
          if (sibling.nodeName.toLowerCase() === element.nodeName.toLowerCase()) {
            nth++
          }
        }

        if (nth > 1) {
          selector += `:nth-of-type(${nth})`
        }

        path.unshift(selector)

        if (element.id) {
          break
        }

        element = element.parentElement!
        if (!element || element === iframeDoc.body) {
          break
        }
      }

      return path.join(' > ')
    }

    // 获取元素信息
    function getElementInfo(element: HTMLElement): SelectedElement {
      const info: SelectedElement = {
        tagName: element.tagName.toLowerCase(),
        textContent: element.textContent?.trim().substring(0, 100),
      }

      if (element.id) {
        info.id = element.id
      }

      if (element.className && typeof element.className === 'string') {
        info.className = element.className
          .split(' ')
          .filter(cls => !cls.startsWith('visual-editor-'))
          .join(' ')
      }

      try {
        info.xpath = getXPath(element)
      } catch (e) {
        console.warn('获取 XPath 失败:', e)
      }

      try {
        info.selector = getSelector(element)
      } catch (e) {
        console.warn('获取选择器失败:', e)
      }

      return info
    }

    // 处理鼠标移动
    function handleMouseMove(e: MouseEvent) {
      if (selectedElement) {
        return // 如果已选择元素，不处理悬浮
      }

      const target = e.target as HTMLElement
      if (!target || target === hoveredElement) {
        return
      }

      // 忽略脚本和样式元素
      if (target.tagName === 'SCRIPT' || target.tagName === 'STYLE' || target.tagName === 'HEAD') {
        return
      }

      // 移除之前的悬浮效果
      if (hoveredElement) {
        hoveredElement.classList.remove('visual-editor-hover')
      }

      // 添加新的悬浮效果
      hoveredElement = target
      hoveredElement.classList.add('visual-editor-hover')
    }

    // 处理鼠标离开
    function handleMouseLeave(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target === hoveredElement) {
        target.classList.remove('visual-editor-hover')
        hoveredElement = null
      }
    }

    // 处理元素点击
    function handleElementClick(e: MouseEvent) {
      e.preventDefault()
      e.stopPropagation()

      const target = e.target as HTMLElement
      if (!target) {
        return
      }

      // 忽略脚本和样式元素
      if (target.tagName === 'SCRIPT' || target.tagName === 'STYLE' || target.tagName === 'HEAD') {
        return
      }

      // 移除之前的选中效果
      if (selectedElement && selectedElement !== target) {
        selectedElement.classList.remove('visual-editor-selected')
        selectedElement.classList.remove('visual-editor-hover')
      }

      // 添加选中效果
      selectedElement = target
      selectedElement.classList.remove('visual-editor-hover')
      selectedElement.classList.add('visual-editor-selected')

      // 获取元素信息并通知主网站
      const elementInfo = getElementInfo(target)
      onElementSelected(elementInfo)
    }

    // 添加事件监听器
    iframeDoc.addEventListener('mousemove', handleMouseMove, true)
    iframeDoc.addEventListener('mouseleave', handleMouseLeave, true)
    iframeDoc.addEventListener('click', handleElementClick, true)

    // 返回清理函数
    return () => {
      // 移除事件监听器
      iframeDoc.removeEventListener('mousemove', handleMouseMove, true)
      iframeDoc.removeEventListener('mouseleave', handleMouseLeave, true)
      iframeDoc.removeEventListener('click', handleElementClick, true)

      // 移除样式
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }

      // 清理元素状态
      if (hoveredElement) {
        hoveredElement.classList.remove('visual-editor-hover')
      }
      if (selectedElement) {
        selectedElement.classList.remove('visual-editor-selected')
      }
    }
  } catch (error) {
    console.error('注入可视化编辑脚本失败:', error)
    return () => { }
  }
}

/**
 * 清除 iframe 中的选中状态
 * @param iframe iframe 元素
 */
export function clearSelection(iframe: HTMLIFrameElement): void {
  if (!iframe.contentWindow || !iframe.contentDocument) {
    return
  }

  try {
    const iframeDoc = iframe.contentDocument
    const selectedElements = iframeDoc.querySelectorAll('.visual-editor-selected, .visual-editor-hover')
    selectedElements.forEach((el) => {
      el.classList.remove('visual-editor-selected', 'visual-editor-hover')
    })
  } catch (error) {
    console.error('清除选中状态失败:', error)
  }
}

/**
 * 格式化选中元素信息为提示词文本
 * @param elements 选中的元素列表
 * @returns 格式化的提示词文本
 */
export function formatElementsToPrompt(elements: SelectedElement[]): string {
  if (elements.length === 0) {
    return ''
  }

  let prompt = '\n\n【选中的页面元素信息】\n'
  elements.forEach((el, index) => {
    prompt += `${index + 1}. `
    prompt += `标签: ${el.tagName}`
    if (el.id) {
      prompt += `, ID: ${el.id}`
    }
    if (el.className) {
      prompt += `, 类名: ${el.className}`
    }
    if (el.textContent) {
      prompt += `, 文本内容: ${el.textContent.substring(0, 50)}${el.textContent.length > 50 ? '...' : ''}`
    }
    if (el.selector) {
      prompt += `, 选择器: ${el.selector}`
    }
    prompt += '\n'
  })

  return prompt
}
