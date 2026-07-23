// 提示词管理 UI 组件
// 替代 App.js 中的 qa (弹窗 ~2059) 和 Ja (下拉 ~2278)，纯本地模式
import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";
import { Ua } from "../../config/options.js";
import {
  mapToLibraryCards,
  getRecent,
  recordRecent,
  getRecentCards,
  searchCards,
  saveAndNotify
} from "../../services/promptManager.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();

/* ========== 内联 SVG 图标 ========== */

var SparklesIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 18, height: 18, fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  children: X.jsx("path", {
    d: "M10 1.5l1.2 4.3 4.3 1.2-4.3 1.2L10 18.5l-1.2-4.3-4.3-1.2 4.3-1.2L10 1.5z"
  })
});

var CloseIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 18, height: 18, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("line", { x1: 5, y1: 5, x2: 15, y2: 15 }),
      X.jsx("line", { x1: 15, y1: 5, x2: 5, y2: 15 })
    ]
  })
});

function SearchIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsx("circle", { cx: 8.5, cy: 8.5, r: 6 })
  });
}

function PlusIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 2,
    children: X.jsxs("g", {
      children: [
        X.jsx("line", { x1: 10, y1: 3, x2: 10, y2: 17 }),
        X.jsx("line", { x1: 3, y1: 10, x2: 17, y2: 10 })
      ]
    })
  });
}

function CheckIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 15, height: 15, fill: "none",
    stroke: "currentColor", strokeWidth: 2,
    children: X.jsx("polyline", { points: "4 10 8 14 16 6" })
  });
}

function EditIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsx("path", {
      d: "M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"
    })
  });
}

function TrashIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("line", { x1: 5, y1: 6, x2: 15, y2: 6 }),
        X.jsx("path", { d: "M7.5 6V4.5a1 1 0 011-1h3a1 1 0 011 1V6M14 6l-.5 10.5a1 1 0 01-1 .9h-5a1 1 0 01-1-.9L6 6" })
      ]
    })
  });
}

function ListIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("path", { d: "M3 6h14M3 10h14M3 14h10" })
      ]
    })
  });
}

function ClockIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("circle", { cx: 10, cy: 10, r: 7.5 }),
        X.jsx("polyline", { points: "10 5.5 10 10 13.5 12" })
      ]
    })
  });
}

var SearchFullIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("circle", { cx: 8.5, cy: 8.5, r: 6 }),
      X.jsx("line", { x1: 13.5, y1: 13.5, x2: 18, y2: 18 })
    ]
  })
});

/* ========== 工具 ========== */

function typeLabel(cat) {
  return { text: "文本", image: "生图", video: "视频" }[cat] || "通用";
}

function typeTagColor(cat) {
  return {
    text: "bg-[rgba(34,197,94,0.12)] text-[#4ade80]",
    image: "bg-[rgba(59,130,246,0.12)] text-[#60a5fa]",
    video: "bg-[rgba(168,85,247,0.12)] text-[#c084fc]",
    all: "bg-[rgba(255,255,255,0.08)] text-[#aaa]"
  }[cat || "all"];
}

/* ========== PromptLibrary 弹窗 ========== */

function PromptLibrary({
  open,
  onClose,
  onUse,
  onToast,
  defaultCategory = "",
  presetPrompts = []
}) {
  var _a = Y.useState("mine"), activeTab = _a[0], setActiveTab = _a[1];
  var _b = Y.useState(""), searchKeyword = _b[0], setSearchKeyword = _b[1];
  var _c = Y.useState(defaultCategory), selectedCategory = _c[0], setSelectedCategory = _c[1];
  var _d = Y.useState(""), toast = _d[0], setToast = _d[1];
  var _f = Y.useState(-1), editingIndex = _f[0], setEditingIndex = _f[1];
  var _g = Y.useState(false), showNewForm = _g[0], setShowNewForm = _g[1];
  var _h = Y.useState({ title: "", type: "all", prompt: "" }), formData = _h[0], setFormData = _h[1];

  // 重置状态
  Y.useEffect(function () {
    if (open) {
      setSelectedCategory(defaultCategory);
      setSearchKeyword("");
      setActiveTab("mine");
      setEditingIndex(-1);
      setShowNewForm(false);
    }
  }, [open]);

  var showToast = function (msg) {
    if (onToast) onToast(msg);
    setToast(msg);
    setTimeout(function () { setToast(""); }, 2000);
  };

  var localCards = Y.useMemo(function () {
    return mapToLibraryCards(presetPrompts);
  }, [presetPrompts]);

  var recentIds = Y.useMemo(function () {
    return getRecent();
  }, [open]);

  var recentCards = Y.useMemo(function () {
    return getRecentCards(localCards, recentIds);
  }, [localCards, recentIds]);

  var displayCards = Y.useMemo(function () {
    var cards = activeTab === "recent" ? recentCards : localCards;
    if (selectedCategory) {
      cards = cards.filter(function (c) { return c.category === selectedCategory; });
    }
    cards = searchCards(cards, searchKeyword);
    return cards;
  }, [activeTab, recentCards, localCards, selectedCategory, searchKeyword]);

  var handleUse = function (card) {
    recordRecent(card.id);
    if (onUse) {
      onUse(card.content);
      onClose();
    } else {
      showToast("已复制到剪贴板");
      try { navigator.clipboard.writeText(card.content); } catch (e) {}
    }
  };

  var startEdit = function (presetIndex) {
    var preset = presetPrompts[presetIndex];
    if (!preset) return;
    setEditingIndex(presetIndex);
    setFormData({
      title: preset.title || "",
      type: preset.type || "all",
      prompt: preset.prompt || ""
    });
  };

  var saveEdit = function () {
    if (!formData.title.trim()) { showToast("请输入标题"); return; }
    var newPresets = presetPrompts.slice();
    newPresets[editingIndex] = {
      title: formData.title,
      type: formData.type,
      prompt: formData.prompt,
      enabled: newPresets[editingIndex].enabled !== false
    };
    saveAndNotify(newPresets);
    setEditingIndex(-1);
    showToast("已保存");
  };

  var handleDelete = function (presetIndex) {
    var newPresets = presetPrompts.filter(function (_, i) { return i !== presetIndex; });
    saveAndNotify(newPresets);
    if (editingIndex === presetIndex) setEditingIndex(-1);
    showToast("已删除");
  };

  var startNew = function () {
    setShowNewForm(true);
    setFormData({ title: "", type: selectedCategory || "all", prompt: "" });
  };

  var saveNew = function () {
    if (!formData.title.trim()) { showToast("请输入标题"); return; }
    var newPresets = presetPrompts.slice();
    newPresets.push({
      title: formData.title,
      type: formData.type,
      prompt: formData.prompt,
      enabled: true
    });
    saveAndNotify(newPresets);
    setShowNewForm(false);
    setFormData({ title: "", type: "all", prompt: "" });
    showToast("已添加");
  };

  var closeModal = function () {
    setEditingIndex(-1);
    setShowNewForm(false);
  };

  var isModalOpen = editingIndex >= 0 || showNewForm;

  if (!open) return null;

  return Un.createPortal(X.jsx("div", {
    className: "fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-[6px] p-6 nowheel nopan nodrag",
    onClick: onClose,
    children: [
      // 主弹窗
      X.jsxs("div", {
        className: "relative w-[88vw] h-[84vh] max-w-[1400px] bg-[#141414] border border-[#2a2a2a] rounded-[18px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden",
        onClick: function (e) { e.stopPropagation(); },
        children: [
          // Toast
          toast && X.jsx("div", {
            className: "absolute top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-sm text-white shadow-2xl",
            children: toast
          }),

          // Header：品牌 + 搜索 + 关闭
          X.jsxs("div", {
            className: "shrink-0 flex items-center gap-[16px] px-[20px] h-[60px] border-b border-[#222]",
            children: [
              X.jsxs("div", {
                className: "flex items-center gap-[8px] pr-[16px] border-r border-[#2a2a2a]",
                children: [
                  X.jsx("span", { className: "text-white flex items-center", children: SparklesIcon }),
                  X.jsx("span", { className: "text-base font-semibold text-white whitespace-nowrap", children: "提示词库" })
                ]
              }),
              X.jsxs("div", {
                className: "relative flex-1 max-w-[320px]",
                children: [
                  X.jsx("span", {
                    className: "absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]",
                    children: SearchFullIcon
                  }),
                  X.jsx("input", {
                    value: searchKeyword,
                    onChange: function (e) { setSearchKeyword(e.target.value); },
                    placeholder: "搜索标题或提示词内容",
                    className: "w-full h-[34px] pl-[34px] pr-3 text-[13px] bg-[#1a1a1a] border border-[#333] rounded-[10px] text-[#e5e5e5] placeholder-[#666] focus:border-[#555] outline-none transition-colors duration-200"
                  })
                ]
              }),
              X.jsx("button", {
                onClick: onClose,
                className: "ml-auto w-[32px] h-[32px] flex items-center justify-center text-[#888] hover:text-white hover:bg-[#2a2a2a] rounded-[8px] transition-colors bg-transparent border-none cursor-pointer",
                children: CloseIcon
              })
            ]
          }),

          // Body：左侧导航 + 主区域
          X.jsxs("div", {
            className: "flex flex-1 overflow-hidden",
            children: [
              // 左侧导航
              X.jsx("div", {
                className: "w-[170px] shrink-0 border-r border-[#222] px-[12px] py-[16px] flex flex-col gap-[6px]",
                children: [
                  X.jsxs("button", {
                    onClick: function () { setActiveTab("mine"); },
                    className: "flex items-center gap-[10px] px-[12px] py-[10px] rounded-[10px] text-[13px] w-full text-left transition-all duration-150 border-none cursor-pointer "
                      + (activeTab === "mine" ? "bg-[#1f1f1f] text-white font-medium" : "bg-transparent text-[#999] hover:bg-[#1f1f1f] hover:text-[#ddd]"),
                    children: [X.jsx("span", { className: "w-4 h-4 flex items-center", children: ListIcon() }), "我的提示词"]
                  }),
                  X.jsxs("button", {
                    onClick: function () { setActiveTab("recent"); },
                    className: "flex items-center gap-[10px] px-[12px] py-[10px] rounded-[10px] text-[13px] w-full text-left transition-all duration-150 border-none cursor-pointer "
                      + (activeTab === "recent" ? "bg-[#1f1f1f] text-white font-medium" : "bg-transparent text-[#999] hover:bg-[#1f1f1f] hover:text-[#ddd]"),
                    children: [X.jsx("span", { className: "w-4 h-4 flex items-center", children: ClockIcon() }), "最近使用"]
                  })
                ]
              }),

              // 主区域
              X.jsxs("div", {
                className: "flex-1 flex flex-col overflow-hidden",
                children: [
                  // 工具栏：分类 + 新建
                  X.jsxs("div", {
                    className: "shrink-0 h-[58px] px-[20px] flex items-center justify-between gap-[12px]",
                    children: [
                      X.jsx("div", {
                        className: "flex items-center gap-[8px]",
                        children: [
                          { label: "全部", value: "" },
                          ...Ua
                        ].map(function (opt) {
                          // Treat "" as generic "all" matching defaultCategory logic if applicable
                          let isActive = selectedCategory === opt.value;
                          return X.jsx("button", {
                            onClick: function () { setSelectedCategory(opt.value); },
                            className: "px-[14px] py-[7px] text-[12px] rounded-full transition-all duration-150 cursor-pointer "
                              + (isActive
                                ? "bg-white text-[#141414] font-medium border border-transparent"
                                : "bg-[#1f1f1f] text-[#999] border border-transparent hover:bg-[#2a2a2a] hover:text-[#ddd]"),
                            children: opt.label
                          }, opt.value || "all");
                        })
                      }),
                      X.jsxs("button", {
                        onClick: startNew,
                        className: "flex items-center gap-[6px] px-[14px] py-[8px] text-[12px] bg-[#2563eb] hover:bg-[#3b82f6] text-white rounded-[10px] border-none transition-colors duration-150 cursor-pointer",
                        children: [PlusIcon(), "新建提示词"]
                      })
                    ]
                  }),

                  // 卡片网格
                  X.jsx("div", {
                    className: "flex-1 overflow-y-auto custom-scrollbar px-[20px] pt-[4px] pb-[24px]",
                    children: displayCards.length === 0 ? X.jsx("div", {
                      className: "h-full flex items-center justify-center text-[14px] text-[#666]",
                      children: activeTab === "recent" ? "还没有使用记录" : "暂无提示词，点击「新建提示词」添加"
                    }) : X.jsx("div", {
                      className: "grid gap-[14px]",
                      style: { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" },
                      children: displayCards.map(function (card) {
                        return X.jsxs("div", {
                          key: card.id,
                          className: "group relative bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] hover:bg-[#1f1f1f] rounded-[14px] p-[16px] flex flex-col gap-[10px] cursor-pointer transition-all duration-150",
                          onClick: function () { handleUse(card); },
                          children: [
                            // 第一行：标题 + 操作图标
                            X.jsxs("div", {
                              className: "flex items-start justify-between gap-[10px]",
                              children: [
                                X.jsx("h3", {
                                  className: "text-[14px] font-semibold text-white leading-[1.4] truncate",
                                  title: card.title,
                                  children: card.title || "(未命名)"
                                }),
                                X.jsxs("div", {
                                  className: "flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0",
                                  children: [
                                    X.jsx("button", {
                                      onClick: function (evt) { evt.stopPropagation(); startEdit(card.presetIndex); },
                                      className: "w-[26px] h-[26px] flex items-center justify-center rounded-[6px] bg-transparent text-[#888] border-none hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer",
                                      title: "编辑",
                                      children: EditIcon()
                                    }),
                                    X.jsx("button", {
                                      onClick: function (evt) { evt.stopPropagation(); handleDelete(card.presetIndex); },
                                      className: "w-[26px] h-[26px] flex items-center justify-center rounded-[6px] bg-transparent text-[#888] border-none hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.12)] transition-colors cursor-pointer",
                                      title: "删除",
                                      children: TrashIcon()
                                    })
                                  ]
                                })
                              ]
                            }),
                            // 内容预览
                            X.jsx("p", {
                              className: "text-[12px] text-[#888] leading-[1.6] flex-1",
                              style: {
                                display: "-webkit-box",
                                WebkitLineClamp: "2",
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden"
                              },
                              children: card.content || "(空)"
                            }),
                            // 底部：标签 + 使用按钮
                            X.jsxs("div", {
                              className: "flex items-center justify-between mt-[4px]",
                              children: [
                                X.jsx("span", {
                                  className: "px-[8px] py-[3px] rounded-[6px] text-[11px] font-medium " + typeTagColor(card.category),
                                  children: typeLabel(card.category)
                                }),
                                X.jsx("button", {
                                  onClick: function (evt) { evt.stopPropagation(); handleUse(card); },
                                  className: "px-[12px] py-[5px] text-[12px] rounded-[8px] border border-[#333] bg-transparent text-[#60a5fa] hover:bg-[rgba(59,130,246,0.12)] hover:border-[rgba(59,130,246,0.3)] transition-all duration-150 cursor-pointer",
                                  children: "使用"
                                })
                              ]
                            })
                          ]
                        });
                      })
                    })
                  })
                ]
              })
            ]
          })
        ]
      }),

      // 编辑/新建弹窗 modal
      isModalOpen && Un.createPortal(X.jsx("div", {
        className: "fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(0,0,0,0.6)]",
        onClick: closeModal,
        children: X.jsxs("div", {
          className: "w-[520px] bg-[#1a1a1a] border border-[#333] rounded-[16px] p-[22px] flex flex-col gap-[14px] shadow-2xl",
          onClick: function (e) { e.stopPropagation(); },
          children: [
            X.jsx("h3", {
              className: "text-[15px] font-semibold text-white",
              children: showNewForm ? "新建提示词" : "编辑提示词"
            }),
            // 标题 + 类型
            X.jsxs("div", {
              className: "flex gap-[10px]",
              children: [
                X.jsxs("div", {
                  className: "flex flex-col gap-[6px] flex-[2]",
                  children: [
                    X.jsx("label", { className: "text-[12px] text-[#888]", children: "标题" }),
                    X.jsx("input", {
                      className: "bg-[#141414] border border-[#333] rounded-[10px] px-[12px] py-[10px] text-[#e5e5e5] text-[13px] outline-none focus:border-[#555]",
                      placeholder: "标题",
                      value: formData.title,
                      onChange: function (e) { setFormData(Object.assign({}, formData, { title: e.target.value })); }
                    })
                  ]
                }),
                X.jsxs("div", {
                  className: "flex flex-col gap-[6px] flex-1",
                  children: [
                    X.jsx("label", { className: "text-[12px] text-[#888]", children: "类型" }),
                    X.jsxs("select", {
                      className: "bg-[#141414] border border-[#333] rounded-[10px] px-[12px] py-[10px] text-[#e5e5e5] text-[13px] outline-none focus:border-[#555]",
                      value: formData.type,
                      onChange: function (e) { setFormData(Object.assign({}, formData, { type: e.target.value })); },
                      children: [
                        X.jsx("option", { value: "all", children: "通用" }),
                        X.jsx("option", { value: "text", children: "文本" }),
                        X.jsx("option", { value: "image", children: "生图" }),
                        X.jsx("option", { value: "video", children: "视频" })
                      ]
                    })
                  ]
                })
              ]
            }),
            // 提示词内容
            X.jsxs("div", {
              className: "flex flex-col gap-[6px]",
              children: [
                X.jsx("label", { className: "text-[12px] text-[#888]", children: "提示词内容" }),
                X.jsx("textarea", {
                  className: "bg-[#141414] border border-[#333] rounded-[10px] px-[12px] py-[10px] text-[#e5e5e5] text-[13px] outline-none focus:border-[#555] resize-none h-[160px] leading-[1.6]",
                  placeholder: "提示词内容",
                  value: formData.prompt,
                  onChange: function (e) { setFormData(Object.assign({}, formData, { prompt: e.target.value })); }
                })
              ]
            }),
            // 底部按钮
            X.jsxs("div", {
              className: "flex items-center justify-between mt-[4px]",
              children: [
                !showNewForm ? X.jsx("button", {
                  onClick: function () { handleDelete(editingIndex); closeModal(); },
                  className: "px-[14px] py-[8px] text-[12px] bg-transparent text-[#ef4444] border-none rounded-[10px] hover:bg-[rgba(239,68,68,0.12)] cursor-pointer transition-colors",
                  children: "删除"
                }) : X.jsx("span"),
                X.jsxs("div", {
                  className: "flex gap-[10px]",
                  children: [
                    X.jsx("button", {
                      onClick: closeModal,
                      className: "px-[16px] py-[8px] text-[12px] bg-[#2a2a2a] text-[#ccc] border-none rounded-[10px] hover:bg-[#333] cursor-pointer transition-colors",
                      children: "取消"
                    }),
                    X.jsx("button", {
                      onClick: showNewForm ? saveNew : saveEdit,
                      className: "flex items-center gap-[6px] px-[14px] py-[8px] text-[12px] bg-[#2563eb] text-white border-none rounded-[10px] hover:bg-[#3b82f6] cursor-pointer transition-colors",
                      children: showNewForm ? "添加" : "保存"
                    })
                  ]
                })
              ]
            })
          ]
        })
      }), document.body)
    ]
  }), document.body);
}

/* ========== PromptDropdown 下拉 ========== */

function PromptDropdown({
  category: e,
  presetPrompts: t,
  onApply: n,
  onToast: r
}) {
  var _a = Y.useState(false), open = _a[0], setOpen = _a[1];
  var _b = Y.useState(false), libraryOpen = _b[0], setLibraryOpen = _b[1];
  var _c = Y.useState(""), searchText = _c[0], setSearchText = _c[1];
  var ref = Y.useRef(null);

  var enabled = t.filter(function (p) { return p.enabled !== false; });
  var matchFn = function (p) { return p.type === e || p.type === "all" || !p.type; };
  var sorted = enabled.filter(matchFn).concat(enabled.filter(function (p) { return !matchFn(p); }));
  var filtered = searchText.trim() ? sorted.filter(function (p) {
    return p.title.toLowerCase().includes(searchText.trim().toLowerCase());
  }) : sorted;

  Y.useEffect(function () {
    if (!open) return;
    var handler = function (evt) {
      ref.current && !ref.current.contains(evt.target) && setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return function () { document.removeEventListener("mousedown", handler, true); };
  }, [open]);

  var handleApply = function (content) {
    n(content);
    setOpen(false);
  };

  return X.jsxs("div", {
    className: "relative nodrag flex items-center",
    ref: ref,
    children: [
      X.jsx("div", { className: "w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" }),
      X.jsx("button", {
        className: "flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]",
        onClick: function (evt) { evt.stopPropagation(); setOpen(function (v) { return !v; }); setSearchText(""); },
        children: X.jsx("span", { className: "truncate", children: "提示词" })
      }),
      open && X.jsxs("div", {
        className: "absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex flex-col max-h-80 overflow-hidden nowheel nopan nodrag",
        onClick: function (evt) { evt.stopPropagation(); },
        children: [
          X.jsx("div", {
            className: "shrink-0 px-2 pt-2 pb-1",
            children: X.jsx("input", {
              className: "w-full text-[11px] bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-gray-300 placeholder:text-gray-600 focus:border-blue-500 outline-none",
              placeholder: "搜索...",
              value: searchText,
              onChange: function (evt) { setSearchText(evt.target.value); }
            })
          }),
          X.jsx("div", {
            className: "flex-1 overflow-y-auto custom-scrollbar px-2 pt-1 pb-2",
            children: filtered.length === 0 ? X.jsx("div", {
              className: "px-2 py-1.5 text-[11px] text-gray-600",
              children: "暂无提示词"
            }) : filtered.map(function (p, i) {
              return X.jsx("button", {
                className: "w-full block mb-1 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200",
                onClick: function () { handleApply(p.prompt); },
                title: p.title,
                children: p.title
              }, "local-" + i);
            })
          }),
          X.jsx("div", {
            className: "shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 border-t border-[#333]",
            children: X.jsxs("button", {
              className: "flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors",
              onClick: function () { setLibraryOpen(true); setOpen(false); },
              children: [SparklesIcon, " 提示词库"]
            })
          })
        ]
      }),
      X.jsx(PromptLibrary, {
        open: libraryOpen,
        onClose: function () { setLibraryOpen(false); },
        onUse: function (content) { n(content); },
        onToast: r,
        defaultCategory: e,
        presetPrompts: t
      })
    ]
  });
}

export { PromptLibrary, PromptDropdown };