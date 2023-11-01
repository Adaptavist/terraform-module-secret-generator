module product-infrastructure/test

require (
	github.com/go-sql-driver/mysql v1.5.0 // indirect
	github.com/gruntwork-io/terratest v0.41.26
	github.com/stretchr/testify v1.8.1
)

replace github.com/klauspost/compress v1.15.11 => github.com/klauspost/compress v1.15.10

go 1.13
