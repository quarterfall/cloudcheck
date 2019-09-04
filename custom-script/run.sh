# if you place a script called 'run.sh' (like this one), in your repository,
# this is the script that will be executed by the Cloud Check server instead of
# the default script

echo "Hey, I am a custom script!"

# write the answer to a source file
echo "module.exports = $answer" > ./src/answer.js

# install dependencies
npm install

# run the unit tests
npm test