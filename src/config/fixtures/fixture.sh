name=""

for param in "$@"; do
  value="${param#--name=}"

  if [ "$value" != "$param" ]; then
    name="$value"
  fi
done

if [ -z "$name" ]; then
  echo '`--name` is missing'
  exit 1
fi

echo "Name: $name" > /dev/null 2>&1
