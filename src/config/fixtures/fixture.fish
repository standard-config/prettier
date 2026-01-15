set name ""

for param in $argv
    set value (string replace --regex '^--name=' '' -- "$param")

    if test "$value" != "$param"
        set name "$value"
    end
end

if test -z "$name"
    echo '`--name` is missing'
    exit 1
end

echo "Name: $name" >/dev/null 2>&1
