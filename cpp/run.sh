# write the answer to a source file
echo $answer > ./src/answer.hpp

# go to the src folder
cd src

# build the executable
make

# run the test
./test