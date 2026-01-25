import os
import re
import yaml

# Directory containing your markdown files
DIRECTORY = "."

# Regex to detect front matter
FRONT_MATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

def normalize_tag(tag):
    """Normalize a single tag."""
    return " ".join(tag.strip().lower().split())

for filename in os.listdir(DIRECTORY):
    if not (filename.endswith(".md") or filename.endswith(".mdx")):
        continue

    path = os.path.join(DIRECTORY, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    match = FRONT_MATTER_RE.match(content)
    if not match:
        print(f"Skipping {filename}: no front matter")
        continue

    front_matter_str = match.group(1)
    try:
        front_matter = yaml.safe_load(front_matter_str)
    except Exception as e:
        print(f"Skipping {filename}: YAML parse error ({e})")
        continue

    # Only proceed if there is a 'tags' field
    if "tags" in front_matter and isinstance(front_matter["tags"], list):
        original_tags = front_matter["tags"]
        normalized_tags = [normalize_tag(t) for t in original_tags]

        # Only update if changed
        if normalized_tags != original_tags:
            front_matter["tags"] = normalized_tags

            # Rebuild front matter string
            new_front_matter_str = yaml.safe_dump(front_matter, sort_keys=False).strip()
            new_content = f"---\n{new_front_matter_str}\n---\n" + content[match.end():]

            # Write back to file
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)

            print(f"Normalized tags in {filename}: {original_tags} → {normalized_tags}")

