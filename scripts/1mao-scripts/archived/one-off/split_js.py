import os
import re

def split_js_file(input_filepath, output_dir="split_output", split_size_kb=50):
    """
    将大型或混淆(minified)的 JS 文件拆分成多个较小的文件。
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    try:
        with open(input_filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"找不到文件: {input_filepath}")
        return

    target_size = split_size_kb * 1024
    chunks = []
    
    start = 0
    while start < len(content):
        end = min(start + target_size, len(content))
        
        if end < len(content):
            # 尝试寻找合适的分隔符，比如函数结束后的分号
            semi_idx = content.find(';', end)
            if semi_idx != -1 and semi_idx - end < 2000:
                end = semi_idx + 1
                    
        chunks.append(content[start:end])
        start = end
        
    for i, chunk in enumerate(chunks):
        out_path = os.path.join(output_dir, f'part_{i+1}.js')
        with open(out_path, 'w', encoding='utf-8') as out:
            out.write(chunk)
            
    print(f"拆分完成！共生成了 {len(chunks)} 个文件，保存在 '{output_dir}' 目录中。")

if __name__ == "__main__":
    # 使用示例
    # 请将 'your_file.js' 替换为你要拆分的 JS 文件的路径
    split_js_file('your_file.js', split_size_kb=100)
