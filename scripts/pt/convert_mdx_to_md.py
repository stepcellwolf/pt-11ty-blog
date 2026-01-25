import os
import re

DIRECTORY = "."  # change if needed
AUTHOR_LINE = "author: Predrag Tasevski"

date_regex = re.compile(r"^date:\s*(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?", re.MULTILINE)

for filename in os.listdir(DIRECTORY):
    if not filename.endswith(".mdx"):
        continue

    old_path = os.path.join(DIRECTORY, filename)

    with open(old_path, "r", encoding="utf-8") as f:
        content = f.read()

    match = date_regex.search(content)
    if not match:
        print(f"Skipping {filename}: no date found")
        continue

    date_only = match.group(1)

    # Replace date line with date only
    content = date_regex.sub(f"date: {date_only}", content, count=1)

    # Add author if missing
    if "author:" not in content:
        lines = content.splitlines()
        for i, line in enumerate(lines):
            if line.startswith("date:"):
                lines.insert(i + 1, AUTHOR_LINE)
                break
        content = "\n".join(lines)

    # Build new filename
    base_name = filename.replace(".mdx", "")
    new_filename = f"{date_only}-{base_name}.md"
    new_path = os.path.join(DIRECTORY, new_filename)

    # Write updated content
    with open(new_path, "w", encoding="utf-8") as f:
        f.write(content)

    # Remove old file
    os.remove(old_path)

    print(f"Converted: {filename} → {new_filename}")

